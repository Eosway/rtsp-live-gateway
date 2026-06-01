import type { Hono } from 'hono'
import type { StreamRegistry } from '../stream/streamRegistry.js'

function buildMetricsText(metrics: { sources: number; runningSources: number; viewers: number; bytesOutTotal: number }): string {
  return [
    '# HELP rtsp_gw_sources Number of current stream sources.',
    '# TYPE rtsp_gw_sources gauge',
    `rtsp_gw_sources ${metrics.sources}`,
    '# HELP rtsp_gw_running_sources Number of currently running stream sources.',
    '# TYPE rtsp_gw_running_sources gauge',
    `rtsp_gw_running_sources ${metrics.runningSources}`,
    '# HELP rtsp_gw_viewers Number of active playback sessions.',
    '# TYPE rtsp_gw_viewers gauge',
    `rtsp_gw_viewers ${metrics.viewers}`,
    '# HELP rtsp_gw_bytes_out_total Total fanout bytes output.',
    '# TYPE rtsp_gw_bytes_out_total counter',
    `rtsp_gw_bytes_out_total ${metrics.bytesOutTotal}`,
  ].join('\n')
}

export function registerMetricsRoute(app: Hono<{ Variables: { requestId: string } }>, registry: StreamRegistry): void {
  app.get('/v1/metrics', (c) => {
    c.header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
    return c.body(`${buildMetricsText(registry.snapshotMetrics())}\n`)
  })
}
