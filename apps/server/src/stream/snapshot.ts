import type { ApiErrorBody, StreamState, StreamStatusResponse } from '@eosway/rtsp-live-gateway-protocol'
import type { ResolvedStreamCreateRequest } from '../types.js'

export interface StreamSnapshotInput {
  streamId: string
  state: StreamState
  viewerCount: number
  createdAt: string
  startedAt?: string
  lastActiveAt?: string
  req: ResolvedStreamCreateRequest
  bytesOutTotal: number
  currentFfmpegPid?: number
  startAttemptsTotal: number
  lastStartLatencyMs?: number
  lastErrorAt?: string
  recentError?: ApiErrorBody
}

export function toStreamStatusResponse(input: StreamSnapshotInput): StreamStatusResponse {
  return {
    streamId: input.streamId,
    state: input.state,
    viewerCount: input.viewerCount,
    createdAt: input.createdAt,
    startedAt: input.startedAt,
    lastActiveAt: input.lastActiveAt,
    resolvedConfig: {
      transport: input.req.transport,
      video: input.req.video,
      audio: input.req.audio,
    },
    stats: {
      bytesOutTotal: input.bytesOutTotal,
      currentFfmpegPid: input.currentFfmpegPid,
      startAttemptsTotal: input.startAttemptsTotal,
      lastStartLatencyMs: input.lastStartLatencyMs,
      lastErrorAt: input.lastErrorAt,
    },
    recentError: input.recentError,
  }
}
