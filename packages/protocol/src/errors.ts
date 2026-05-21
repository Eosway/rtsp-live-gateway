export type ApiErrorCode =
  /** 参数错误 */
  | 'INVALID_ARGUMENT'
  | 'INVALID_RTSP_URL'
  /** SSRF 拦截 */
  | 'SSRF_BLOCKED'
  | 'STREAM_NOT_FOUND'
  | 'STREAM_DELETED'
  /** 源数量上限 */
  | 'SOURCE_LIMIT_REACHED'
  /** 单源观众数量上限 */
  | 'VIEWER_LIMIT_REACHED'
  /** 启动超时 */
  | 'STREAM_START_TIMEOUT'
  /** 上游鉴权失败 */
  | 'UPSTREAM_AUTH_FAILED'
  | 'UPSTREAM_NOT_FOUND'
  /** 上游连接失败 */
  | 'UPSTREAM_CONNECT_FAILED'
  /** 未产出有效媒体 */
  | 'NO_MEDIA_OUTPUT'
  /** 找不到 FFmpeg */
  | 'FFMPEG_NOT_FOUND'
  /** FFmpeg 不支持当前输入或输出 */
  | 'FFMPEG_UNSUPPORTED'
  /** FFmpeg 退出 */
  | 'FFMPEG_EXITED'
  | 'INTERNAL_ERROR'

export interface InvalidArgumentErrorDetail {
  /** 字段名 */
  field?: string
  maxSources?: number
  maxViewersPerSource?: number
}

export interface SsrfBlockedErrorDetail {
  /** 端口 */
  port?: number
  /** 主机名 */
  host?: string
  /** IP 地址 */
  address?: string
}

export interface StreamStartTimeoutErrorDetail {
  /** 摘要 */
  summary?: string
  /** stderr 尾部 */
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
  /** 时间戳 */
  ts?: number
  /** 级别 */
  level?: 'warn' | 'error'
  /** 失败原因 */
  reason?: FfmpegFailureReason
  /** 摘要 */
  summary?: string
  /** stderr 尾部 */
  stderrTail?: string[]
}

export interface FfmpegProcessErrorDetail {
  /** 失败原因 */
  reason?: FfmpegFailureReason
  /** 摘要 */
  summary?: string
  /** 原始错误 */
  error?: string
  /** stderr 尾部 */
  stderrTail?: string[]
}

export interface FfmpegExitedErrorDetail {
  /** 失败原因 */
  reason?: FfmpegFailureReason
  /** 摘要 */
  summary?: string
  /** 退出码 */
  code?: number | null
  /** 退出信号 */
  signal?: string | null
  /** stderr 尾部 */
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
