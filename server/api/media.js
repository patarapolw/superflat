// @ts-check

import path from 'path'
// @ts-ignore
import fileUpload from 'fastify-file-upload'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import { FILEPATH } from '../shared'

/**
 *
 * @param {import('fastify').FastifyInstance} f
 * @param {any} _
 * @param {Function} next
 */
export default (f, _, next) => {
  f.get(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string' }
          }
        }
      }
    },
    async (req, reply) => {
      const { q } = req.query
      if (fs.existsSync(q)) {
        reply.send(fs.createReadStream(q))
        return
      }

      reply.status(404).send()
    }
  )

  f.register(fileUpload)

  f.post(
    '/upload',
    {
      schema: {
        body: {
          type: 'object',
          required: ['file'],
          properties: {
            file: { type: 'object' }
          }
        }
      }
    },
    async (req) => {
      const { file } = req.body

      let filename = file.name
      if (filename === 'image.png') {
        filename = dayjs().format('YYYYMMDD-HHmm') + '.png'
      }

      filename = (() => {
        const originalFilename = filename

        while (fs.existsSync(path.join(FILEPATH, filename))) {
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

      fs.mkdirpSync(FILEPATH)
      file.mv(path.join(FILEPATH, filename))

      return {
        filename,
        url: `/api/media?q=${encodeURIComponent(path.join(FILEPATH, filename))}`
      }
    }
  )

  next()
}
