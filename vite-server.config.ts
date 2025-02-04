import { defineConfig, createLogger, Plugin, normalizePath } from 'vite'
import Fsp from 'node:fs/promises'
import { isBuiltin as isNodeBuiltin } from 'node:module'
import { join as joinPath } from 'node:path'
import { spawn as spawnProcess } from 'child_process'
import { log } from 'node:console'

// Vite config for bundling server

const logger = createLogger('info', {
  prefix: '[server]',
})

// Define externals for server build
// All vendor libraries will be present in node_modules
//   and should be loaded via regular node resolution
const externalsState = {
  // Last time the externals were updated (used to throttle updates and file reads)
  lastUpdated: 0,
  // Last update time of the package.json file
  lastUpdatedPackageJson: 0,
  // List of packages from package.json (warning: phantom, modules should not be used)
  externalPackages: [] as Array<string>,
  // Optional list of external modules
  externalRegexp: [] as Array<RegExp>,
}

// extra args that can be passed to vite like: vite build -w -c ... -- --customArg1 --customArg2=value
let extraParams = process.argv.slice(2).filter((el, i, arr) => arr.slice(0, i).includes('--'))
// check if we should start server after build: --start-server or --start-server=true
let shouldStartServer = extraParams.some(arg => /^--start-server(?:=true)$/.test(arg))


// Vite config
// @see: https://vite.dev/config/
export default defineConfig({
  customLogger: logger,
  // its server. public files will be available in client build
  publicDir: false,

  build: {

    // enabling sourcemaps for dev and prod
    // 1. this sourcemaps will not be accessible from user side
    // 2. you will have a proper stack trace in case of error in production (see node --enable-source-maps)
    sourcemap: true,

    // output directory for server build
    outDir: 'dist/server',

    lib: {
      entry: 'src-server/index.ts',
      fileName: 'index',
      formats: ['es'],
    }
  },

  plugins: [
    // make all vendor packages external
    viteExternalsPlugin(),
    // start server after build if needed
    // Tip: you should specify the chunk name to run process from.
    //      Currently its 'index' which is the default chunk name.
    //      To explicitly specify chunk name use `{build: { ... lib: { ... entry: { CHUNK_NAME: 'source-file.ts' } } } }`
    startServerPlugin('index'),
  ],
})

/*
 * ==============================
 *     PLUGINS AND UTILITIES
 * ==============================
 */

/**
 * Update the list of external modules
 */
async function updateExternals(): Promise<void> {
  // skip library update if package.json was not updated
  const stats = await Fsp.stat('package.json')
  if (stats.mtimeMs <= externalsState.lastUpdatedPackageJson) {
    return
  }

  externalsState.lastUpdatedPackageJson = stats.mtimeMs

  // read package.json and collect all installed packages
  const packageJson = JSON.parse(await Fsp.readFile('package.json', 'utf-8'))

  const packages = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
  ]

  externalsState.externalPackages = packages

  /*
   * PS: If you are using "ghost dependencies" (e.g. packages that are not listed directly in package.json),
   *    you should get list of directories in node_modules and put them in externalPackages.
   */
}

/**
 * Check if a module is external.
 * Function is synchronous for performance reasons.
 */
function isExternal(id: string): boolean {
  // Mark all node builtins as external (e.g. fs, path, etc.)
  if (isNodeBuiltin(id)) {
    return true
  }

  // Check for external packages
  const vendorPackages = externalsState.externalPackages
  for (const element of vendorPackages) {
    if (id.startsWith(element)) {
      return true
    }
  }

  // Check for optional regexps
  const vendorRegexp = externalsState.externalRegexp
  for (const element of vendorRegexp) {
    if (element.test(id)) {
      return true
    }
  }

  return false
}

/**
 * Vite plugin that marks all external modules as external.
 */
function viteExternalsPlugin(): Plugin {
  return {
    name: 'node-externals',
    resolveId: {
      order: 'pre',
      async handler(id) {
        // Update externals if needed. Throttle updates to once per second.
        const shouldUpdateExternals = Date.now() - externalsState.lastUpdated > 1000
        if (shouldUpdateExternals) {
          await updateExternals()
          externalsState.lastUpdated = Date.now()
        }

        if (isExternal(id)) {
          return { id, external: true }
        }
      }
    }
  }
}

/**
 * Vite plugin that starts a server after build.
 */
function startServerPlugin(chunkNameToRun: string): Plugin {
  // Custom node arguments and application arguments
  // Tip: --enable-source-maps will transform bundled code to
  //      source code path and line numbers.
  //      its useful for debugging and production troubleshooting
  const nodeArgs = ['--enable-source-maps']

  // Custom node arguments and application arguments
  // You may adapt `extraParams` to pass custom arguments to the server process
  const appArgs = []

  // Path to the server module. Will be filled later
  let appPath = ''

  // Timeout to kill the server process
  const serverKillTimeout = 3000

  // Throttle time to start the server. Server will not restart faster than this time
  const serverStartThrottle = 500

  // `setTimeout` handle. Indicates that next server start is scheduled
  let serverStartThrottleHandle: ReturnType<typeof setTimeout> | null = null

  // Last time the server was started. Used to throttle server restarts
  let serverStartLast = 0

  // Current server process state
  let procState: ReturnType<typeof startProcess> | null = null

  // Function that runs a server, pipes stdio and returns process state
  function startProcess() {
    // Build arguments to start node
    const args = [...nodeArgs, appPath, ...appArgs]

    // Start the server process
    const proc = spawnProcess('node', args, { stdio: 'inherit' })

    let closed = false

    // Timeout handle to kill the process
    let closeTimeoutHandle: ReturnType<typeof setTimeout> | null = null

    // used to wait for the process to exit
    const closePromise = new Promise<number>((resolve) => {
      proc.on('close', (code) => {
        closed = true

        // Clear kill timeout handle. Process already exited
        if (closeTimeoutHandle) {
          clearTimeout(closeTimeoutHandle)
        }

        resolve(code ?? 0)
      })
    })

    // Function that tries to gracefully close the server
    //   by sending SIGINT signal and then SIGKILL if needed
    function close() {
      proc.kill('SIGINT')

      if (!closeTimeoutHandle) {
        closeTimeoutHandle = setTimeout(() => {
          proc.kill('SIGKILL')
        }, serverKillTimeout)
      }
    }

    return {
      proc,
      close,
      closePromise,
      get pid() {
        return proc.pid
      },
      get closed() {
        return closed
      },
    }

  }

  return {
    name: 'start-server',
    writeBundle: {
      order: 'post',
      async handler(options, bundle) {
        // Do nothing if cli parameter is not set
        if (!shouldStartServer) {
          return
        }

        // Resolve server module path in dist

        const rootDir = options.dir ?? './'
        const chunk = Object.values(bundle).find(c => c.name === chunkNameToRun) ?? null
        if (!chunk) {
          this.warn(`Chunk ${chunkNameToRun} not found to run server`)
          return
        }

        const chunkPath = chunk.fileName
        const moduleFileName = normalizePath(joinPath(rootDir, chunkPath))
        appPath = moduleFileName

        // Start server, handle restarts and throttling

        if (serverStartThrottleHandle) {
          // Start already scheduled
          return
        }

        const logInfo = this.info

        // Time that need to wait to prevent repeated server restarts
        const throttleTime = Math.max(0, serverStartThrottle - (Date.now() - serverStartLast))

        // Scheduling server start
        // Tip: at first start throttleTime will be 0, so server will start immediately
        serverStartThrottleHandle = setTimeout(async () => {
          // Close the previous server if it is running and wait for it to exit
          if (procState && !procState.closed) {
            logInfo('Stopping server ...')
            procState.close()
            await procState.closePromise
          }

          // Start the server

          const state = startProcess()
          state.closePromise.then(exitCode => {
            logInfo(`Server pid=${state.pid} stopped with code ${exitCode}`)
          })

          procState = state
          serverStartLast = Date.now()

          serverStartThrottleHandle = null
        }, throttleTime)

      }
    },
  }
}