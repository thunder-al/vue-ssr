import {type App, getCurrentInstance, inject, onMounted, onServerPrefetch, ref} from 'vue'

export function createSSRCtx() {
  const componentServerDataIndexes = new Map<number, number>()
  let ssrData = new Map<number, any>()
  let serverCtx: any = null

  if (!import.meta.env.SSR) {
    function loadSsrData() {
      // load ssr data from script#ssr-data
      const script = document.querySelector('script#ssr-data')
      if (!script) {
        return
      }
      const data = JSON.parse(script.innerHTML)
      ssrData = new Map(data)

    }

    loadSsrData()
  }

  function provideSsrContext(ctx: any) {
    if (import.meta.env.SSR) {
      serverCtx = ctx
      if (ctx.dataStorage) {
        ssrData = ctx.dataStorage
      }
    }
  }

  function getComponentServerDataNewIndex(hash: number) {
    if (!componentServerDataIndexes.has(hash)) {
      componentServerDataIndexes.set(hash, 0)
      return 0
    }

    const index = componentServerDataIndexes.get(hash)!
    componentServerDataIndexes.set(hash, index + 1)
    return index + 1
  }

  return {
    componentServerDataIndexes,
    getComponentServerDataNewIndex,
    get ssrData() {
      return ssrData
    },
    get serverCtx() {
      return serverCtx
    },
    provideSsrContext,
  }
}

export function ssrContextPlugin(app: App, ctx: ReturnType<typeof createSSRCtx>) {
  app.provide('ssr', ctx)
  Object.defineProperty(app, 'ssrCtx', {get: () => ctx})
}

export function useSsrCtx(app?: App) {
  if (app && 'ssrCtx' in app && app.ssrCtx) {
    return app.ssrCtx as ReturnType<typeof createSSRCtx>
  }

  const ctx = inject<ReturnType<typeof createSSRCtx>>('ssr')
  if (!ctx) {
    throw new Error('useSsrCtx() must be called in a setup function')
  }

  return ctx
}

/**
 * FNV-1a (Fowler–Noll–Vo) Fast Non-Cryptographic Hash Function
 * @see https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
export function hashFast(str: string): number {
  const prime = 0x01000193 // FNV prime for 32-bit
  let hash = 0x811c9dc5 // FNV offset basis for 32-bit

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, prime) // FNV prime
  }

  return hash
}

function makeComponentPath(comp: ReturnType<typeof getCurrentInstance>) {
  if (!comp) {
    return ''
  }

  const path: Array<string> = []

  while (comp) {
    const type = comp.type
    let name = type?.__name ?? type?.name ?? 'Anonymous'

    const key = comp.vnode.key?.toString()
    if (key) {
      name += `(${key})`
    }

    path.unshift(name)

    comp = comp.parent
  }

  return path.join('\n')
}

export function useComponentPathHash() {
  const comp = getCurrentInstance()
  if (!comp) {
    throw new Error('useComponentPathHash() must be called in a setup function')
  }

  const path = makeComponentPath(comp)

  return hashFast(path)
}

export function useSsrId(action?: string | null) {
  const hash = useComponentPathHash()

  if (!action) {
    const ssr = useSsrCtx()
    const index = ssr.getComponentServerDataNewIndex(hash)

    return hashFast(`${hash}-${index}`)
  }

  return hashFast(`${hash}-${action}`)
}

export function useAsyncData<T>(
  func: (ssrId: number) => Promise<T> | T,
  options: {
    key?: string | null,
    clientOnly?: boolean,
    manual?: boolean,
    revalidate?: boolean
  } = {},
) {
  const id = useSsrId(options?.key)
  const ssr = useSsrCtx()

  const error = ref<string | null>(null)
  const data = ref<T | null>(null)
  const fromServer = ref(false)
  const state = ref<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function execute() {
    state.value = 'loading'
    try {
      data.value = await func(id)
    } catch (e: any) {
      error.value = e.message
      state.value = 'error'
      return
    }
    state.value = 'done'
    error.value = null
  }

  if (!options.manual) {
    if (import.meta.env.SSR && !options.clientOnly) {

      // data is stored in golang-like style: [result, err]

      // action of server

      onServerPrefetch(async () => {
        await execute()

        if (state.value === 'error') {
          ssr.ssrData.set(id, [null, error.value])
          return
        }

        ssr.ssrData.set(id, [data.value])
      })

    } else {

      // action of client

      const hasSsrData = ssr.ssrData.has(id)
      if (hasSsrData) {
        const [result, err] = ssr.ssrData.get(id)!

        if (err) {
          state.value = 'error'
          error.value = err
          data.value = null
        } else {
          state.value = 'done'
          error.value = null
          data.value = result
        }

      }

      // if data does not exist, or it should be requested again from client
      if (!hasSsrData || options?.revalidate) {
        onMounted(execute)
      }

    }
  }

  return {
    id,
    data,
    state,
    error,
    execute,
    fromServer,
  }
}