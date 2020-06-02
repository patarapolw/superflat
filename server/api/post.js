// @ts-check

import path from 'path'
import fs from 'fs-extra'
import { FILEPATH } from '../shared'

/**
 *
 * @param {import('fastify').FastifyInstance} f
 * @param {any} _
 * @param {Function} next
 */
const handler = (f, _, next) => {
  f.get('/', async () => {
    const filename = path.join(FILEPATH, 'content.md')
    return {
      data: fs.existsSync(filename) ? fs.readFileSync(filename, 'utf-8') : ''
    }
  })

  f.put(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'string' }
          }
        }
      }
    },
    async (req, reply) => {
      const { data } = req.body
      const filename = path.join(FILEPATH, 'content.md')

      // console.log(path.resolve(filename))

      if (fs.existsSync(path.resolve(filename))) {
        fs.writeFileSync(filename, data)

        reply.status(201).send()
        return
      }

      fs.ensureFileSync(path.resolve(filename))
      fs.writeFileSync(path.resolve(filename), data)

      reply.status(201).send()
    }
  )

  next()
}

export default handler
