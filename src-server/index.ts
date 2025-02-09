import fastify from 'fastify'
import fastifyMiddie from '@fastify/middie'
import {createSSRMiddleware} from './ssr-middleware.ts'

const app = fastify({
  logger: true,
  disableRequestLogging: true,
})

app.get('/api/hello', async (req, repl) => {
  return {
    hello: 'world',
  }
})

app.register(fastifyMiddie)

app.register(createSSRMiddleware())

await app.listen({
  port: 3000,
  host: '0.0.0.0',
})
