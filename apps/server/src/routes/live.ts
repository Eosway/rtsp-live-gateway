import type { Hono } from 'hono'
import { stream } from 'hono/streaming'
import type { ServerConfig } from '../config.js'
import { ApiError } from '../errors.js'
import { PlaybackSession } from '../stream/playbackSession.js'
import type { StreamRegistry } from '../stream/streamRegistry.js'

interface LiveRouteOptions {
  config: ServerConfig
  registry: StreamRegistry
}

export function registerLiveRoute(app: Hono<{ Variables: { requestId: string } }>, options: LiveRouteOptions): void {
  app.get('/v1/live/:streamId', async (c) => {
    const streamId = c.req.param('streamId')
    if (!streamId) {
      throw new ApiError('INVALID_ARGUMENT', 'streamId is required')
    }
    const source = options.registry.get(streamId)
    if (!source) {
      throw new ApiError('STREAM_NOT_FOUND', 'Stream not found')
    }

    if (source.viewerCount() >= options.config.maxViewersPerSource) {
      throw new ApiError('VIEWER_LIMIT_REACHED', 'Viewer limit reached', {
        maxViewersPerSource: options.config.maxViewersPerSource,
      })
    }

    const session = new PlaybackSession({
      streamId,
      remoteIp: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
      maxQueueBytes: options.config.maxQueueBytes,
    })
    source.addViewer(session)

    try {
      await source.ensureStarted('first_viewer')
    } catch (error) {
      source.removeViewer(session.sessionId, 'startup_failed')
      throw error
    }

    c.header('content-type', 'video/x-flv')
    c.header('cache-control', 'no-store, no-cache, must-revalidate')
    c.header('x-content-type-options', 'nosniff')

    return stream(c, async (output) => {
      output.onAbort(() => {
        source.removeViewer(session.sessionId, 'client_abort')
      })

      try {
        await session.drain(async (chunk: Uint8Array) => {
          await output.write(chunk)
        })
      } finally {
        source.removeViewer(session.sessionId, session.getCloseReason() ?? 'stream_closed')
      }
    })
  })
}
