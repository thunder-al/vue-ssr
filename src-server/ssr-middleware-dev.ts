import {ConfigEnv, createServer, loadConfigFromFile, mergeConfig, UserConfig} from 'vite'
import {renderToString, SSRContext} from 'vue/server-renderer'
import {FastifyInstance} from 'fastify'
import Fsp from 'node:fs/promises'
import {createSSRDataStorage, makeInternalReverseHttpCall, renderSSRDataStorage} from './ssr-data.ts'

const isProduction = process.env.NODE_ENV === 'production'

export async function devSSRMiddleware(fastify: FastifyInstance) {

  const viteConfigEnv: ConfigEnv = {
    isSsrBuild: true,
    mode: isProduction ? 'production' : 'development',
    command: 'serve',
    isPreview: false,
  }

  const viteConfig = await loadConfigFromFile(viteConfigEnv, 'vite-client.config.ts', '../')
  if (!viteConfig) {
    throw new Error('Vite config not found')
  }

  const ssrViteConfigPatch: UserConfig = {
    clearScreen: false,
    build: {
      ssr: true,
      manifest: true,
    },
    server: {
      middlewareMode: true,
    },
    appType: 'custom',
  }

  const viteServer = await createServer(mergeConfig(viteConfig.config, ssrViteConfigPatch))

  fastify.use(viteServer.middlewares)

  fastify.get('*', async (req, repl) => {
    const serverEntry = await viteServer.ssrLoadModule('/src-frontend/entry-server.ts')

    const dataStorage = createSSRDataStorage()

    const {app: vueApp, ssrCtx: ssrAppCtx} = serverEntry.createApp()

    const internalHttp = (method: string, url: string, body: any) => makeInternalReverseHttpCall(fastify, method, url, body)

    const ctx: SSRContext = {dataStorage, internalHttp}
    ssrAppCtx.provideSsrContext(ctx)

    const rendered = await renderToString(vueApp, ctx)

    const htmlRaw = await Fsp.readFile('./index.html', 'utf-8')
    const html = await viteServer.transformIndexHtml(req.url, htmlRaw)

    const ssr = html.replace('<!--ssr-->', rendered)
      .replace('data-hydrate="false"', 'data-hydrate="true"')
      .replace('<!--ssr-data-->', renderSSRDataStorage(dataStorage))

    repl.header('Content-Type', 'text/html')
    repl.send(ssr)
  })
}