import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { RedisSessionStore } from './lib/sessionStore.js';
import sql from './lib/sql.js';
import redis from './lib/redis.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import blogPostRoutes from './routes/blog-posts.js';
import adminAuthRoutes from './routes/admin/auth.js';
import adminWebAuthnRoutes from './routes/admin/webauthn.js';
import adminProductRoutes from './routes/admin/products.js';
import adminCategoryRoutes from './routes/admin/categories.js';
import adminReviewRoutes from './routes/admin/reviews.js';
import adminBlogPostRoutes from './routes/admin/blog-posts.js';
import adminProductVariantRoutes from './routes/admin/product-variants.js';
import { cleanupExpiredChallenges } from './utils/cleanupExpiredChallenges.js';
import { initSentry, captureException } from './lib/sentry.js';
import * as Sentry from '@sentry/node';

export async function buildApp(opts = {}) {
  const sqlClient = opts.sql ?? sql
  const redisClient = opts.redis ?? redis

  const fastify = Fastify({
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
    logger: opts.logger ?? {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Initialize Sentry for error tracking
  initSentry(fastify);

  await fastify.register(helmet, { global: true });

  // Register CORS - allow both frontend and admin app
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL, process.env.ADMIN_URL]
      : ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
  });

  // Register cookie support
  await fastify.register(cookie);

  // Register session with Redis store
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required')
  }

  await fastify.register(session, {
    store: new RedisSessionStore(redisClient),
    secret: sessionSecret,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax'
    },
    saveUninitialized: false
  });

  // Decorators for database clients
  fastify.decorate('sql', sqlClient)
  fastify.decorate('redis', redisClient)

  await fastify.register(rateLimit, {
    global: true,
    max: process.env.NODE_ENV === 'test' ? 10000 : 100,
    timeWindow: '1 minute',
    redis: redisClient,
    errorResponseBuilder: (_request, context) => ({
      error: `Too many requests. Retry after ${context.after}`
    }),
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true
    }
  });

  // Sentry user context tracking
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.session?.adminId) {
      Sentry.setUser({ id: request.session.adminId });
    }
  });

  // Schedule periodic WebAuthn challenge cleanup. The Bull worker (pnpm worker)
  // handles this when deployed as a separate process; this interval is the fallback
  // for environments (e.g. Railway single-service) where the worker isn't running.
  fastify.addHook('onReady', async () => {
    cleanupExpiredChallenges(fastify.sql, fastify.log).catch(captureException)
    const interval = setInterval(
      () => cleanupExpiredChallenges(fastify.sql, fastify.log).catch(captureException),
      5 * 60 * 1000
    )
    interval.unref()
    fastify.addHook('onClose', async () => clearInterval(interval))
  })

  // Global error handler - capture all unhandled errors in Sentry
  fastify.setErrorHandler(async (error, request, reply) => {
    // Log the error
    request.log.error(error);

    // Capture exception in Sentry with request context
    // Note: All sensitive data is automatically sanitized via beforeSend hook
    captureException(error, {
      tags: {
        route: request.routeOptions?.url || request.url,
        method: request.method,
        statusCode: error.statusCode || 500,
      },
      extra: {
        url: request.url,
        params: request.params,
        query: request.query,
        body: request.body,
        headers: request.headers,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
      user: request.session?.adminId ? { id: request.session.adminId } : undefined,
    });

    // Determine status code
    const statusCode = error.statusCode || 500;

    // Send error response
    reply.code(statusCode).send({
      error: true,
      message: statusCode === 500 ? 'Internal Server Error' : error.message,
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });

  // Health check route
  fastify.get('/health', async (request, reply) => {
    try {
      await sqlClient`SELECT 1`
      await redisClient.ping()
      return {
        status: 'ok',
        database: 'connected',
        redis: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  });

  // Register public routes
  fastify.register(productRoutes, { prefix: '/api/products' });
  fastify.register(categoryRoutes, { prefix: '/api/categories' });
  fastify.register(blogPostRoutes, { prefix: '/api/blog-posts' });

  // Register admin routes
  fastify.register(adminAuthRoutes, { prefix: '/api/admin/auth' });
  fastify.register(adminWebAuthnRoutes, { prefix: '/api/admin/webauthn' });
  fastify.register(adminProductRoutes, { prefix: '/api/admin/products' });
  fastify.register(adminCategoryRoutes, { prefix: '/api/admin/categories' });
  fastify.register(adminReviewRoutes, { prefix: '/api/admin/reviews' });
  fastify.register(adminBlogPostRoutes, { prefix: '/api/admin/blog-posts' });
  fastify.register(adminProductVariantRoutes, { prefix: '/api/admin/variants' });

  return fastify;
}
