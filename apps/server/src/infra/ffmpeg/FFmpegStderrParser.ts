import type { ApiErrorCode } from '@rtsp-gateway/protocol'

export interface FFmpegDiagEvent {
  ts: number
  level: 'warn' | 'error'
  code: ApiErrorCode
  line: string
}

export class FFmpegStderrParser {
  parse(line: string): FFmpegDiagEvent | undefined {
    const lower = line.toLowerCase()

    if (lower.includes('401 unauthorized') || lower.includes('403 forbidden') || lower.includes('method describe failed')) {
      return {
        ts: Date.now(),
        level: 'error',
        code: 'UPSTREAM_AUTH_FAILED',
        line,
      }
    }

    if (lower.includes('connection refused') || lower.includes('timed out') || lower.includes('failed to resolve') || lower.includes('unable to open')) {
      return {
        ts: Date.now(),
        level: 'error',
        code: 'UPSTREAM_CONNECT_FAILED',
        line,
      }
    }

    if (lower.includes('unknown decoder') || lower.includes('unknown encoder')) {
      return {
        ts: Date.now(),
        level: 'error',
        code: 'FFMPEG_UNSUPPORTED',
        line,
      }
    }

    if (lower.includes('output file is empty') || lower.includes('no packets were sent')) {
      return {
        ts: Date.now(),
        level: 'warn',
        code: 'NO_MEDIA_OUTPUT',
        line,
      }
    }

    return undefined
  }
}
