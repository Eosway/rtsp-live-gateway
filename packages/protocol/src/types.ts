export type StreamId = string
export type SourceKey = string
export type SessionId = string

export type RtspTransport = 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https'

export type AudioMode = 'drop' | 'copy'
export type VideoMode = 'auto' | 'transcode'

export type StreamState = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export interface VideoOptions {
  mode?: VideoMode
  codec?: 'h264' | 'h265'
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
    video: {
      mode: NonNullable<VideoOptions['mode']>
      codec: NonNullable<VideoOptions['codec']>
    }
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
  | 'SOURCE_LIMIT_REACHED'
  | 'VIEWER_LIMIT_REACHED'
  | 'STREAM_START_TIMEOUT'
  | 'UPSTREAM_AUTH_FAILED'
  | 'UPSTREAM_NOT_FOUND'
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
  summary?: string
  stderrTail?: string[]
}

export type FfmpegFailureReason =
  | 'auth_failed'
  | 'not_found'
  | 'connection_refused'
  | 'timeout'
  | 'dns_failed'
  | 'connect_failed'
  | 'unsupported_codec'
  | 'no_media_output'
  | 'invalid_output'
  | 'process_error'
  | 'exit_before_output'
  | 'exit_while_running'

export interface FfmpegDiagnosticErrorDetail {
  ts?: number
  level?: 'warn' | 'error'
  reason?: FfmpegFailureReason
  summary?: string
  stderrTail?: string[]
}

export interface FfmpegProcessErrorDetail {
  reason?: FfmpegFailureReason
  summary?: string
  error?: string
  stderrTail?: string[]
}

export interface FfmpegExitedErrorDetail {
  reason?: FfmpegFailureReason
  summary?: string
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
  SOURCE_LIMIT_REACHED: Required<Pick<InvalidArgumentErrorDetail, 'maxSources'>>
  VIEWER_LIMIT_REACHED: Required<Pick<InvalidArgumentErrorDetail, 'maxViewersPerSource'>>
  STREAM_START_TIMEOUT: StreamStartTimeoutErrorDetail
  UPSTREAM_AUTH_FAILED: FfmpegDiagnosticErrorDetail
  UPSTREAM_NOT_FOUND: FfmpegDiagnosticErrorDetail
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
