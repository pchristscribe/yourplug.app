import { buildApp } from './app.js'
import sql from './lib/sql.js'
import redis from './lib/redis.js'
import { flushSentry } from './lib/sentry.js'

const fastify = await buildApp()

// Graceful shutdown
const closeGracefully = async (signal) => {
  console.log(`\nReceived signal to terminate: ${signal}`)

  try {
    await fastify.close()
    console.log('Fastify server closed')

    await sql.end({ timeout: 5 })
    console.log('Database disconnected')

    await redis.quit()
    console.log('Redis disconnected')

    await flushSentry()
    console.log('Sentry events flushed')

    process.exit(0)
  } catch (error) {
    console.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGINT', closeGracefully)
process.on('SIGTERM', closeGracefully)

async function start() {
  try {
    const port = process.env.PORT || 3001
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`\n🚀 Server ready at http://localhost:${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
