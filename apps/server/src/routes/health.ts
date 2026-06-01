import type { HealthzResponse } from '@eosway/rtsp-live-gateway-protocol'
import type { Hono } from 'hono'

interface HealthRouteOptions {
  ffmpegPath: string
}

export function registerHealthRoute(app: Hono<{ Variables: { requestId: string } }>, options: HealthRouteOptions): void {
  app.get('/v1/healthz', (c) => {
    const response: HealthzResponse = {
      status: 'ok',
      ffmpegPath: options.ffmpegPath,
      uptimeSec: Math.floor(process.uptime()),
    }
    return c.json(response)
  })
}
