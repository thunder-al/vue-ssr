import {FastifyInstance} from 'fastify'

const isProduction = import.meta.env.MODE === 'production'

export function createSSRMiddleware() {
  return async function (fastify: FastifyInstance) {
    if (!isProduction) {
      return import('./ssr-middleware-dev.ts').then(mod => mod.devSSRMiddleware(fastify))
    }

    return import('./ssr-middleware-prod.ts').then(mod => mod.prodSSRMiddleware(fastify))
  }
}