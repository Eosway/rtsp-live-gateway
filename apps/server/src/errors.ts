import type { ApiErrorBody, ApiErrorCode, ApiErrorDetailByCode } from '@eosway/rtsp-live-gateway-protocol'

const STATUS_BY_ERROR: Record<ApiErrorCode, number> = {
  INVALID_ARGUMENT: 400,
  INVALID_RTSP_URL: 400,
  SSRF_BLOCKED: 403,
  STREAM_NOT_FOUND: 404,
  STREAM_DELETED: 404,
  SOURCE_LIMIT_REACHED: 429,
  VIEWER_LIMIT_REACHED: 429,
  STREAM_START_TIMEOUT: 504,
  UPSTREAM_AUTH_FAILED: 502,
  UPSTREAM_CONNECT_FAILED: 502,
  NO_MEDIA_OUTPUT: 502,
  FFMPEG_NOT_FOUND: 500,
  FFMPEG_UNSUPPORTED: 500,
  FFMPEG_EXITED: 502,
  INTERNAL_ERROR: 500,
}

export class ApiError<TCode extends ApiErrorCode = ApiErrorCode> extends Error {
  readonly code: TCode
  readonly status: number
  readonly detail?: ApiErrorDetailByCode[TCode]

  constructor(code: TCode, message: string, detail?: ApiErrorDetailByCode[TCode], status?: number) {
    super(message)
    this.code = code
    this.detail = detail
    this.status = status ?? STATUS_BY_ERROR[code] ?? 500
  }

  toBody(requestId?: string): ApiErrorBody<TCode> {
    return {
      code: this.code,
      message: this.message,
      ...(requestId ? { requestId } : {}),
      ...(this.detail ? { detail: this.detail } : {}),
    }
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }
  return new ApiError('INTERNAL_ERROR', 'Internal server error')
}
