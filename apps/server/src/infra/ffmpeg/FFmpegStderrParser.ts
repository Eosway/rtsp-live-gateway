import type { ApiErrorCode, FfmpegFailureReason, FfmpegDiagnosticErrorDetail } from '@eosway/rtsp-live-gateway-protocol'
import { maskRtspUrlsInText } from '../../lib/index.js'

export interface FFmpegDiagEvent {
  ts: number
  level: 'warn' | 'error'
  code: ApiErrorCode
  reason?: FfmpegFailureReason
  summary: string
  line: string
}

function buildEvent(code: ApiErrorCode, line: string, reason: FfmpegFailureReason, summary: string): FFmpegDiagEvent {
  return {
    ts: Date.now(),
    level: 'error',
    code,
    reason,
    summary,
    line,
  }
}

export class FFmpegStderrParser {
  parse(line: string): FFmpegDiagEvent | undefined {
    const lower = line.toLowerCase()

    if (lower.includes('401 unauthorized') || lower.includes('403 forbidden') || lower.includes('authentication failed')) {
      return buildEvent('UPSTREAM_AUTH_FAILED', line, 'auth_failed', 'RTSP upstream authentication failed')
    }

    if (lower.includes('404 not found') || lower.includes('not found')) {
      return buildEvent('UPSTREAM_NOT_FOUND', line, 'not_found', 'RTSP upstream returned 404 Not Found')
    }

    if (lower.includes('connection refused')) {
      return buildEvent('UPSTREAM_CONNECT_FAILED', line, 'connection_refused', 'RTSP upstream connection was refused')
    }

    if (lower.includes('timed out') || lower.includes('timeout')) {
      return buildEvent('UPSTREAM_CONNECT_FAILED', line, 'timeout', 'RTSP upstream connection timed out')
    }

    if (lower.includes('failed to resolve') || lower.includes('name or service not known') || lower.includes('temporary failure in name resolution')) {
      return buildEvent('UPSTREAM_CONNECT_FAILED', line, 'dns_failed', 'RTSP upstream host could not be resolved')
    }

    if (lower.includes('unable to open')) {
      return buildEvent('UPSTREAM_CONNECT_FAILED', line, 'connect_failed', 'FFmpeg could not open the RTSP input')
    }

    if (lower.includes('unknown decoder') || lower.includes('unknown encoder') || lower.includes('unsupported codec')) {
      return buildEvent('FFMPEG_UNSUPPORTED', line, 'unsupported_codec', 'FFmpeg does not support the selected codec')
    }

    if (lower.includes('output file is empty') || lower.includes('no packets were sent')) {
      return buildEvent('NO_MEDIA_OUTPUT', line, 'no_media_output', 'FFmpeg produced no media output')
    }

    return undefined
  }
}

export function toDiagnosticDetail(event: FFmpegDiagEvent): FfmpegDiagnosticErrorDetail {
  return {
    ts: event.ts,
    level: event.level,
    reason: event.reason,
    summary: event.summary,
  }
}

export function summarizeStderrTail(lines: readonly string[]): string[] {
  return lines.map((line) => maskRtspUrlsInText(line).slice(0, 300))
}
