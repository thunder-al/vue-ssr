import {FastifyInstance} from 'fastify'

export function createSSRDataStorage() {
  return new Map<number, any>()
}

export function serializeSSRDataStorage(storage: Map<number, any>) {
  return JSON.stringify([...storage.entries()])
}

export function renderSSRDataStorage(storage: Map<number, any>) {
  const data = serializeSSRDataStorage(storage)

  return `<script type="application/json" id="ssr-data">${data}</script>`
}

export async function makeInternalReverseHttpCall(
  fastify: FastifyInstance,
  method: string,
  url: string,
  body: any,
) {
  const response = await fastify.inject({
    method: method as any,
    url: url,
    body: body,
  })

  return {
    status: response.statusCode,
    message: response.statusMessage,
    data: response.body,
    headers: response.headers,
  }
}