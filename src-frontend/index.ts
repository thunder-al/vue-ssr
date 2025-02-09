import App from './App.vue'
import {createApp as createSPAApp, createSSRApp} from 'vue'
import {createSSRCtx, ssrContextPlugin} from './services/ssr.ts'
import {apiPlugin} from './services/api.ts'

export function createApp(spaMode = false) {
  const app = spaMode
    ? createSPAApp(App)
    : createSSRApp(App)

  const ssrCtx = createSSRCtx()
  app.use(ssrContextPlugin, ssrCtx)
  app.use(apiPlugin)

  return {app, ssrCtx}
}