import 'dotenv/config'
import Queue from 'bull'
import prisma from '../lib/prisma.js'
import redis from '../lib/redis.js'
import { cleanupExpiredChallenges } from '../utils/cleanupExpiredChallenges.js'
import { initSentry, captureException, flushSentry } from '../lib/sentry.js'

// Re-use the existing Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
}

// ── Queues ────────────────────────────────────────────────────────────────

const maintenanceQueue = new Queue('maintenance', { redis: redisConfig })

// ── Job handlers ──────────────────────────────────────────────────────────

maintenanceQueue.process('cleanup-expired-challenges', async (job) => {
  const count = await cleanupExpiredChallenges(prisma, console)
  return { cleaned: count }
})

// ── Recurring schedules ───────────────────────────────────────────────────

async function scheduleJobs() {
  // Remove any existing repeatable jobs so we don't stack duplicates on restart
  const repeatableJobs = await maintenanceQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    await maintenanceQueue.removeRepeatableByKey(job.key)
  }

  // Run expired-challenge cleanup every 5 minutes
  await maintenanceQueue.add(
    'cleanup-expired-challenges',
    {},
    { repeat: { cron: '*/5 * * * *' }, removeOnComplete: 50, removeOnFail: 20 }
  )

  console.log('Scheduled: cleanup-expired-challenges (every 5 minutes)')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

maintenanceQueue.on('completed', (job, result) => {
  console.log(`[worker] ${job.name} completed`, result)
})

maintenanceQueue.on('failed', (job, err) => {
  console.error(`[worker] ${job.name} failed`, err.message)
  captureException(err, { tags: { job: job.name } })
})

const shutdownGracefully = async (signal) => {
  console.log(`\nWorker received ${signal}, shutting down…`)
  try {
    await maintenanceQueue.close()
    await prisma.$disconnect()
    await redis.quit()
    await flushSentry()
    process.exit(0)
  } catch (err) {
    console.error('Error during worker shutdown', err)
    process.exit(1)
  }
}

process.on('SIGINT', shutdownGracefully)
process.on('SIGTERM', shutdownGracefully)

// Bootstrap: initialize Sentry (no fastify instance needed for worker)
if (process.env.SENTRY_DSN) {
  const { default: Sentry } = await import('@sentry/node')
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'production' })
}

await scheduleJobs()
console.log('Worker ready — processing queues…')
