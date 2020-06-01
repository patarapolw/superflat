// @ts-check

import { FastifyInstance } from 'fastify'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import dayjs from 'dayjs'
import fs from 'fs-extra'

/**
 *
 * @param {FastifyInstance} f
 * @param {any} _
 * @param {Function} next
 */
export default (f, _, next) => {
  f.get('/*', async (req, reply) => {
    const p = req.params[0]
    if (p && fs.existsSync(`out/${p}`)) {
      reply.send(fs.createReadStream(`out/${p}`, 'utf8'))
      return
    }

    reply.status(404).send()
  })

  f.register(fileUpload)

  f.post(
    '/upload',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['file'],
          properties: {
            file: { type: 'object' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              filename: { type: 'string' }
            }
          }
        }
      }
    },
    async (req) => {
      const { slug } = req.query
      const { file } = req.body

      let filename = file.name
      if (filename === 'image.png') {
        filename = dayjs().format('YYYYMMDD-HHmm') + '.png'
      }

      filename = (() => {
        const originalFilename = filename

        while (fs.existsSync(`out/${slug}/${filename}`)) {
          const [base, ext] = originalFilename.split(/(\.[a-z]+)$/i)
          filename =
            base +
            '-' +
            Math.random()
              .toString(36)
              .substr(2) +
            (ext || '.png')
        }

        return filename
      })()

      file.mv(`out/${slug}/${filename}`)

      return {
        filename,
        url: `/api/media/${slug}/${filename}`
      }
    }
  )

  next()
}
