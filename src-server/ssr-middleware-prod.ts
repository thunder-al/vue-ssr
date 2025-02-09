import {FastifyInstance} from 'fastify'
import staticPlugin from '@fastify/static'
import Path from 'path'
import Url from 'url'
import {renderToString, SSRContext} from 'vue/server-renderer'
import Fsp from 'node:fs/promises'
import {createSSRDataStorage, makeInternalReverseHttpCall, renderSSRDataStorage} from './ssr-data.ts'

export async function prodSSRMiddleware(fastify: FastifyInstance) {
  const ssrManifest = JSON.parse(await Fsp.readFile('./dist/ssr/.vite/manifest.json', 'utf-8'))
  const ssrManifestRendererEntry: any = Object.values(ssrManifest).find((el: any) => el.name === 'entry-server')
  if (!ssrManifestRendererEntry) {
    throw new Error('entry-server not found in manifest.json')
  }

  const url = Url.pathToFileURL(Path.resolve(`./dist/ssr/${ssrManifestRendererEntry.file}`))
  const serverEntry = await import(url.href)
  const createApp = serverEntry.createApp

  const htmlSrc = await Fsp.readFile('./dist/spa/index.html', 'utf-8')
  const html = htmlSrc.replace('data-hydrate="false"', 'data-hydrate="true"')

  fastify.register(staticPlugin, {
    root: Path.resolve('./dist/spa/static/'),
    prefix: '/static/',
  })

  fastify.get('*', async (req, repl) => {
    const dataStorage = createSSRDataStorage()

    const {app: vueApp, ssrCtx: ssrAppCtx} = createApp()

    const internalHttp = (method: string, url: string, body: any) => makeInternalReverseHttpCall(fastify, method, url, body)

    const ctx: SSRContext = {dataStorage, internalHttp}
    ssrAppCtx.provideSsrContext(ctx)

    const rendered = await renderToString(vueApp, ctx)

    const ssr = html.replace('<!--ssr-->', rendered)
      .replace('<!--ssr-data-->', renderSSRDataStorage(dataStorage))

    repl.header('Content-Type', 'text/html')
    repl.send(ssr)
  })
}