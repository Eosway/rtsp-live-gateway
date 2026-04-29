export type StreamId = string
export type SourceKey = string
export type SessionId = string

export type RtspTransport = 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https'

export type VideoMode = 'auto' | 'copy' | 'transcode'
export type AudioMode = 'drop' | 'copy' | 'transcode'

export type StreamState = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export interface VideoOptions {
  mode?: VideoMode
  codec?: 'libx264' | 'libx265'
}

export interface AudioOptions {
  enabled?: boolean
  mode?: AudioMode
  codec?: 'aac'
  bitrateKbps?: number
}

export interface StreamCreateRequest {
  url: string
  transport?: RtspTransport
  ioTimeoutUs?: number
  video?: VideoOptions
  audio?: AudioOptions
  allowPrivateIp?: boolean
  labels?: Record<string, string>
}

export interface StreamCreateResponse {
  streamId: StreamId
  state: StreamState
  reused: boolean
  createdAt: string
}

export interface StreamStatusResponse {
  streamId: StreamId
  state: StreamState
  viewerCount: number
  createdAt: string
  startedAt?: string
  lastActiveAt?: string
  effectiveConfig: {
    transport: RtspTransport
    video: Required<VideoOptions>
    audio: Required<AudioOptions>
  }
  stats: {
    bytesOut: number
    ffmpegPid?: number
    startAttempts: number
    startLatencyMs?: number
    lastErrorAt?: string
  }
  recentError?: ApiErrorBody
}

export type StreamListResponse = StreamStatusResponse[]

export type StreamDeleteResponse = void

export interface HealthzResponse {
  status: 'ok'
  ffmpegPath: string
  uptimeSec: number
}

export type ApiErrorCode =
  | 'INVALID_ARGUMENT'
  | 'INVALID_RTSP_URL'
  | 'SSRF_BLOCKED'
  | 'STREAM_NOT_FOUND'
  | 'STREAM_DELETED'
  | 'STREAM_START_TIMEOUT'
  | 'UPSTREAM_AUTH_FAILED'
  | 'UPSTREAM_CONNECT_FAILED'
  | 'NO_MEDIA_OUTPUT'
  | 'FFMPEG_NOT_FOUND'
  | 'FFMPEG_UNSUPPORTED'
  | 'FFMPEG_EXITED'
  | 'INTERNAL_ERROR'

export interface InvalidArgumentErrorDetail {
  field?: string
  maxSources?: number
  maxViewersPerSource?: number
}

export interface SsrfBlockedErrorDetail {
  port?: number
  host?: string
  address?: string
}

export interface StreamStartTimeoutErrorDetail {
  stderrTail?: string[]
}

export interface FfmpegDiagnosticErrorDetail {
  ts?: number
  level?: 'warn' | 'error'
}

export interface FfmpegProcessErrorDetail {
  error?: string
  stderrTail?: string[]
}

export interface FfmpegExitedErrorDetail {
  code?: number | null
  signal?: string | null
  stderrTail?: string[]
}

export interface ApiErrorDetailByCode {
  INVALID_ARGUMENT: InvalidArgumentErrorDetail
  INVALID_RTSP_URL: undefined
  SSRF_BLOCKED: SsrfBlockedErrorDetail
  STREAM_NOT_FOUND: undefined
  STREAM_DELETED: undefined
  STREAM_START_TIMEOUT: StreamStartTimeoutErrorDetail
  UPSTREAM_AUTH_FAILED: FfmpegDiagnosticErrorDetail
  UPSTREAM_CONNECT_FAILED: FfmpegDiagnosticErrorDetail
  NO_MEDIA_OUTPUT: FfmpegDiagnosticErrorDetail
  FFMPEG_NOT_FOUND: FfmpegProcessErrorDetail
  FFMPEG_UNSUPPORTED: FfmpegDiagnosticErrorDetail
  FFMPEG_EXITED: FfmpegExitedErrorDetail
  INTERNAL_ERROR: Record<string, unknown>
}

export type ApiErrorDetail = ApiErrorDetailByCode[ApiErrorCode]

export interface ApiErrorBody<TCode extends ApiErrorCode = ApiErrorCode> {
  code: TCode
  message: string
  requestId?: string
  detail?: ApiErrorDetailByCode[TCode]
}
