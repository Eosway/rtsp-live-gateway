import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { randomUUID } from 'node:crypto'
import type { ServerConfig } from './config.js'
import { toApiError } from './errors.js'
import { registerHealthRoute } from './routes/health.js'
import { registerLiveRoute } from './routes/live.js'
import { registerMetricsRoute } from './routes/metrics.js'
import { registerStreamRoutes } from './routes/streams.js'
import { StreamRegistry } from './stream/streamRegistry.js'

interface CreateAppOptions {
  config: ServerConfig
  ffmpegPath: string
  ffprobePath?: string
}

export function createApp(options: CreateAppOptions) {
  const app = new Hono<{ Variables: { requestId: string } }>()
  const registry = new StreamRegistry({
    config: options.config,
    ffmpegPath: options.ffmpegPath,
    ffprobePath: options.ffprobePath,
  })

  app.use(
    '*',
    cors({
      origin: options.config.corsAllowOrigin,
    })
  )

  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? randomUUID()
    c.set('requestId', requestId)
    c.header('x-request-id', requestId)
    await next()
  })

  app.onError((error, c) => {
    const apiError = toApiError(error)
    const requestId = c.get('requestId') as string | undefined
    return c.json(apiError.toBody(requestId), apiError.status as 500)
  })

  registerHealthRoute(app, { ffmpegPath: options.ffmpegPath })
  registerMetricsRoute(app, registry)
  registerStreamRoutes(app, {
    config: options.config,
    registry,
  })
  registerLiveRoute(app, {
    config: options.config,
    registry,
  })

  return app
}
