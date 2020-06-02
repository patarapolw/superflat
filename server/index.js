// @ts-check

// @ts-ignore
import { Nuxt, Builder } from 'nuxt'
import fastify from 'fastify'
import config from '../nuxt.config'
import mediaRouter from './api/media'
import metadataRouter from './api/metadata'
import postRouter from './api/post'

config.dev = process.env.NODE_ENV !== 'production'

async function start() {
  // Instantiate nuxt.js
  const nuxt = new Nuxt(config)

  const {
    host = process.env.HOST || '127.0.0.1',
    port = process.env.PORT || 3000
  } = nuxt.options.server

  await nuxt.ready()
  // Build only in dev mode
  if (config.dev) {
    const builder = new Builder(nuxt)
    await builder.build()
  }

  const app = fastify({
    logger: {
      prettyPrint: true,
      level: 'warn'
    }
  })

  app.use((req, res, next) => {
    if (req.url && !req.url.startsWith('/api')) {
      nuxt.render(req, res, next)
      return
    }
    next()
  })

  app.register(
    (f, _, next) => {
      f.register(mediaRouter, { prefix: '/media' })
      f.register(metadataRouter, { prefix: '/metadata' })
      f.register(postRouter, { prefix: '/post' })

      next()
    },
    {
      logLevel: 'info',
      prefix: '/api'
    }
  )

  app.listen(port, host, (err, addr) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    } else {
      app.log.warn(`Please go to ${addr}`)
    }
  })
}

if (require.main === module) {
  start()
}
