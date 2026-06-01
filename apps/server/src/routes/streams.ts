import type { StreamCreateResponse, StreamListResponse, StreamStatusResponse } from '@eosway/rtsp-live-gateway-protocol'
import type { Hono } from 'hono'
import type { ServerConfig } from '../config.js'
import { ApiError } from '../errors.js'
import { assertRtspTargetAllowed } from '../security/ssrf.js'
import { resolveStreamCreateRequest } from '../stream/create.js'
import type { StreamRegistry } from '../stream/streamRegistry.js'

interface StreamRoutesOptions {
  config: ServerConfig
  registry: StreamRegistry
}

export function registerStreamRoutes(app: Hono<{ Variables: { requestId: string } }>, options: StreamRoutesOptions): void {
  app.post('/v1/streams', async (c) => {
    const body = await c.req.json().catch(() => {
      throw new ApiError('INVALID_ARGUMENT', 'Invalid JSON payload')
    })
    const req = resolveStreamCreateRequest(body)
    await assertRtspTargetAllowed(req.url, {
      allowPrivateIp: options.config.ssrfAllowPrivateIp,
      allowlist: options.config.rtspHostAllowlist,
      denylist: options.config.rtspHostDenylist,
      portAllowlist: options.config.rtspPortAllowlist,
      requestAllowPrivateIp: false,
    })

    const { source, reused } = options.registry.createOrReuse(req)
    const response: StreamCreateResponse = {
      streamId: source.streamId,
      state: source.getState(),
      reused,
      createdAt: source.createdAt,
    }
    return c.json(response)
  })

  app.get('/v1/streams', (c) => {
    const response: StreamListResponse = options.registry.list()
    return c.json(response)
  })

  app.get('/v1/streams/:streamId', (c) => {
    const streamId = c.req.param('streamId')
    if (!streamId) {
      throw new ApiError('INVALID_ARGUMENT', 'streamId is required')
    }
    const source = options.registry.get(streamId)
    if (!source) {
      throw new ApiError('STREAM_NOT_FOUND', 'Stream not found')
    }
    const response: StreamStatusResponse = source.snapshotStatus()
    return c.json(response)
  })

  app.delete('/v1/streams/:streamId', async (c) => {
    const streamId = c.req.param('streamId')
    if (!streamId) {
      throw new ApiError('INVALID_ARGUMENT', 'streamId is required')
    }
    await options.registry.remove(streamId)
    return c.body(null, 204)
  })
}
