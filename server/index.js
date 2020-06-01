import { Nuxt, Builder } from 'nuxt'
import fastify from 'fastify'
import config from '../nuxt.config'

const app = fastify({
  logger: {
    prettyPrint: true
  }
})

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

  app.use(nuxt.render)

  app.listen(port, host, (err) => {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
  })
}

if (require.main === module) {
  start()
}
