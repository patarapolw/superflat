// @ts-check

import { FastifyInstance } from 'fastify'
import Slugify from 'seo-friendly-slugify'
import fs from 'fs-extra'

/**
 *
 * @param {FastifyInstance} f
 * @param {any} _
 * @param {Function} next
 */
const handler = (f, _, next) => {
  const slugify = new Slugify()

  f.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' }
          }
        }
      }
    },
    async (req) => {
      const { slug } = req.query
      const filename = `out/${slug}/content.md`
      return {
        data: fs.existsSync(filename) ? fs.readFileSync(filename, 'utf-8') : ''
      }
    }
  )

  f.put(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            slug: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            slug: { type: 'string' },
            title: { type: 'string' },
            data: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              slug: { type: 'string' }
            }
          }
        }
      }
    },
    async (req) => {
      const { slug } = req.query
      // eslint-disable-next-line prefer-const
      let { slug: newSlug, title, data } = req.body

      if (slug) {
        const filename = `out/${slug}/content.md`
        if (fs.existsSync(filename)) {
          fs.writeFileSync(filename, data)

          return { slug }
        }
      }

      newSlug =
        newSlug ||
        slug ||
        `${(() => {
          const s = title ? slugify.slugify(title) : ''
          return s ? `${s}-` : ''
        })()}${Math.random()
          .toString(36)
          .substr(2)}`

      const filename = `out/${newSlug}/content.md`
      fs.ensureFileSync(filename)
      fs.writeFileSync(filename, data)

      return { slug: newSlug }
    }
  )

  next()
}

export default handler
