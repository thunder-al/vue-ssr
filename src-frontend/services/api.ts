import axios, {type AxiosInstance, type AxiosRequestConfig} from 'axios'
import {type App, inject} from 'vue'
import {useAsyncData, useSsrCtx} from './ssr.ts'

function createApiClient(app: App) {
  const api = axios.create({
    baseURL: '/api',
  })

  if (import.meta.env.SSR) {
    api.interceptors.request.use(async cfg => {
      const ssr = useSsrCtx(app)
      const proxy: any = ssr.serverCtx.internalHttp
      if (proxy) {
        cfg.adapter = async cfg => {
          const method = cfg.method ?? 'get'
          const url = api.getUri(cfg)
          const body = cfg.data

          const data = await proxy(method, url, body)

          return {
            status: data.status,
            statusText: data.message,
            data: data.data,
            headers: data.headers,
            config: cfg,
          }
        }
      }

      return cfg
    })
  }

  return api
}

export function apiPlugin(app: App) {
  const api = createApiClient(app)
  app.provide('api', api)
}

export function useApiClient() {
  const client = inject<AxiosInstance>('api')
  if (!client) {
    throw new Error('Cannot use api client outside of the vue components')
  }

  return client
}

export function useApi<T>(
  request: AxiosRequestConfig<T>,
  options: Parameters<typeof useAsyncData>[1] = {},
) {
  const client = useApiClient()
  return useAsyncData(async () => {
    const {data} = await client(request)
    return data
  }, options)
}