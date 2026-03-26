import type { ApiErrorBody, ApiErrorCode } from "@rtsp-gateway/protocol";

const STATUS_BY_ERROR: Record<ApiErrorCode, number> = {
  INVALID_ARGUMENT: 400,
  INVALID_RTSP_URL: 400,
  SSRF_BLOCKED: 403,
  STREAM_NOT_FOUND: 404,
  STREAM_DELETED: 404,
  STREAM_START_TIMEOUT: 504,
  UPSTREAM_AUTH_FAILED: 502,
  UPSTREAM_CONNECT_FAILED: 502,
  NO_MEDIA_OUTPUT: 502,
  FFMPEG_NOT_FOUND: 500,
  FFMPEG_UNSUPPORTED: 500,
  FFMPEG_EXITED: 502,
  INTERNAL_ERROR: 500
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly detail?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    detail?: Record<string, unknown>,
    status?: number
  ) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.status = status ?? STATUS_BY_ERROR[code] ?? 500;
  }

  toBody(requestId?: string): ApiErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(requestId ? { requestId } : {}),
      ...(this.detail ? { detail: this.detail } : {})
    };
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError("INTERNAL_ERROR", "Internal server error");
}
