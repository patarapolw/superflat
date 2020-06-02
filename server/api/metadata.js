// @ts-check

import fetch from 'node-fetch'
import domino from 'domino'
// @ts-ignore
import { getMetadata } from 'page-metadata-parser'

/**
 *
 * @param {import('fastify').FastifyInstance} f
 * @param {any} _
 * @param {Function} next
 */
const handler = (f, _, next) => {
  f.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' }
          }
        }
      }
    },
    async (req) => {
      const { url } = req.query
      const r = await fetch(url).then((r) => r.text())
      const doc = domino.createWindow(r).document
      return getMetadata(doc, url)
    }
  )

  next()
}

export default handler
