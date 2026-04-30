import type { ApiErrorBody, FfmpegDiagnosticErrorDetail, FfmpegExitedErrorDetail, StreamState, StreamStatusResponse } from '@eosway/rtsp-live-gateway-protocol'
import { ApiError } from '../errors.js'
import { nowIso } from '../lib/index.js'
import { buildFfmpegCommand, resolveVideoPlan } from '../infra/ffmpeg/FFmpegCommandBuilder.js'
import { FFmpegRunner } from '../infra/ffmpeg/FFmpegRunner.js'
import { FFmpegStderrParser, type FFmpegDiagEvent } from '../infra/ffmpeg/FFmpegStderrParser.js'
import type { NormalizedStreamCreateRequest } from '../types.js'
import { FanoutHub } from './FanoutHub.js'
import { PlaybackSession } from './PlaybackSession.js'

interface StreamSourceOptions {
  streamId: string
  sourceKey: string
  req: NormalizedStreamCreateRequest
  ffmpegPath: string
  startupTimeoutMs: number
  idleGraceMs: number
  stopGraceMs: number
  maxStartAttempts: number
  logger: {
    info(message: string, detail?: Record<string, unknown>): void
    warn(message: string, detail?: Record<string, unknown>): void
    error(message: string, detail?: Record<string, unknown>): void
  }
}

export class StreamSource {
  readonly streamId: string
  readonly sourceKey: string
  readonly createdAt: string
  readonly req: NormalizedStreamCreateRequest

  private readonly ffmpegPath: string
  private readonly startupTimeoutMs: number
  private readonly idleGraceMs: number
  private readonly stopGraceMs: number
  private readonly maxStartAttempts: number
  private readonly logger: StreamSourceOptions['logger']

  private state: StreamState = 'idle'
  private readonly sessions = new Map<string, PlaybackSession>()
  private readonly fanout = new FanoutHub()
  private readonly stderrParser = new FFmpegStderrParser()
  private stderrRing: string[] = []

  private runner?: FFmpegRunner
  private startPromise?: Promise<void>
  private stopPromise?: Promise<void>
  private idleTimer?: NodeJS.Timeout
  private stopInProgress = false
  private deleted = false

  private startedAt?: string
  private lastActiveAt?: string
  private bytesOut = 0
  private startAttempts = 0
  private startLatencyMs?: number
  private lastErrorAt?: string
  private recentError?: ApiErrorBody

  constructor(options: StreamSourceOptions) {
    this.streamId = options.streamId
    this.sourceKey = options.sourceKey
    this.req = options.req
    this.ffmpegPath = options.ffmpegPath
    this.startupTimeoutMs = options.startupTimeoutMs
    this.idleGraceMs = options.idleGraceMs
    this.stopGraceMs = options.stopGraceMs
    this.maxStartAttempts = options.maxStartAttempts
    this.logger = options.logger
    this.createdAt = nowIso()
    this.lastActiveAt = this.createdAt
  }

  getState(): StreamState {
    return this.state
  }

  viewerCount(): number {
    return this.sessions.size
  }

  addViewer(session: PlaybackSession): void {
    this.clearIdleTimer()
    this.sessions.set(session.sessionId, session)
    this.fanout.subscribe(session)
    this.lastActiveAt = nowIso()
  }

  removeViewer(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }
    session.close(reason)
    this.fanout.unsubscribe(sessionId, reason)
    this.sessions.delete(sessionId)
    this.lastActiveAt = nowIso()
    if (this.sessions.size === 0) {
      this.scheduleIdleStop()
    }
  }

  scheduleIdleStop(): void {
    if (this.deleted) {
      return
    }
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      void this.stop('idle_timeout').catch((error) => {
        this.logger.error('stream_idle_stop_failed', {
          streamId: this.streamId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }, this.idleGraceMs)
  }

  async ensureStarted(trigger: 'first_viewer' | 'manual'): Promise<void> {
    if (this.deleted) {
      throw new ApiError('STREAM_DELETED', 'Stream has been deleted')
    }
    if (this.stopPromise) {
      await this.stopPromise
      if (this.deleted) {
        throw new ApiError('STREAM_DELETED', 'Stream has been deleted')
      }
    }
    if (this.state === 'running') {
      return
    }
    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this.startWithRetry(trigger)
    try {
      await this.startPromise
    } finally {
      this.startPromise = undefined
    }
  }

  private async startWithRetry(trigger: 'first_viewer' | 'manual'): Promise<void> {
    let lastError: unknown
    for (let attempt = 1; attempt <= this.maxStartAttempts; attempt += 1) {
      try {
        await this.startOnce(trigger, attempt)
        return
      } catch (error) {
        lastError = error
        if (attempt < this.maxStartAttempts) {
          this.logger.warn('ffmpeg_start_retry', {
            streamId: this.streamId,
            attempt,
            error: error instanceof ApiError ? error.toBody() : { message: error instanceof Error ? error.message : String(error) },
          })
        }
      }
    }
    throw lastError instanceof Error ? lastError : new ApiError('FFMPEG_EXITED', 'FFmpeg exited before media output')
  }

  private startOnce(trigger: 'first_viewer' | 'manual', attempt: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.startAttempts += 1
      this.state = 'starting'
      const startedAt = Date.now()
      const runner = new FFmpegRunner()
      this.runner = runner
      const videoPlan = resolveVideoPlan(this.req, attempt)
      const command = buildFfmpegCommand(this.ffmpegPath, this.req, videoPlan)
      let firstChunkSeen = false
      let settled = false

      const settleReject = (error: ApiError) => {
        if (settled) {
          return
        }
        settled = true
        this.recentError = error.toBody()
        this.lastErrorAt = nowIso()
        this.state = 'error'
        reject(error)
      }

      const settleResolve = () => {
        if (settled) {
          return
        }
        settled = true
        this.state = 'running'
        this.startedAt = nowIso()
        this.startLatencyMs = Date.now() - startedAt
        resolve()
      }

      const startupTimer = setTimeout(() => {
        void runner.stop(this.stopGraceMs).finally(() => {
          settleReject(
            new ApiError('STREAM_START_TIMEOUT', 'Stream startup timeout', {
              stderrTail: this.stderrRing.slice(-10),
            })
          )
        })
      }, this.startupTimeoutMs)

      runner.onStdout((chunk) => {
        if (!firstChunkSeen) {
          firstChunkSeen = true
          clearTimeout(startupTimer)
          settleResolve()
        }
        this.bytesOut += chunk.byteLength
        this.fanout.publish(chunk)
      })

      runner.onStderrLine((line) => {
        this.pushStderr(line)
        const diag = this.stderrParser.parse(line)
        if (diag) {
          this.applyDiagEvent(diag)
        }
      })

      runner.onExit((code, signal) => {
        clearTimeout(startupTimer)
        if (!firstChunkSeen) {
          settleReject(
            new ApiError('FFMPEG_EXITED', 'FFmpeg exited before first media chunk', {
              code,
              signal,
              stderrTail: this.stderrRing.slice(-10),
            })
          )
          return
        }
        if (!this.stopInProgress && !this.deleted) {
          this.state = 'error'
          this.lastErrorAt = nowIso()
          const detail: FfmpegExitedErrorDetail = { code, signal }
          this.recentError = {
            code: 'FFMPEG_EXITED',
            message: 'FFmpeg exited while running',
            detail,
          }
          this.fanout.closeAll('ffmpeg_exited')
        }
      })

      runner.onError((error) => {
        clearTimeout(startupTimer)
        settleReject(
          new ApiError('FFMPEG_NOT_FOUND', 'FFmpeg process error before media output', {
            error: error.message,
            stderrTail: this.stderrRing.slice(-10),
          })
        )
      })

      try {
        runner.start(command)
        this.logger.info('ffmpeg_spawned', {
          streamId: this.streamId,
          trigger,
          attempt,
          videoPlan,
          command: command.safePreview,
        })
      } catch (error) {
        clearTimeout(startupTimer)
        settleReject(
          new ApiError('FFMPEG_NOT_FOUND', 'Failed to spawn ffmpeg process', {
            error: error instanceof Error ? error.message : String(error),
          })
        )
      }
    })
  }

  private pushStderr(line: string): void {
    this.stderrRing.push(line)
    if (this.stderrRing.length > 50) {
      this.stderrRing = this.stderrRing.slice(-50)
    }
  }

  private applyDiagEvent(event: FFmpegDiagEvent): void {
    const detail: FfmpegDiagnosticErrorDetail = { ts: event.ts, level: event.level }
    this.recentError = {
      code: event.code,
      message: event.line.slice(0, 300),
      detail,
    }
    this.lastErrorAt = nowIso()
  }

  async stop(reason: string): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise
    }

    this.stopPromise = (async () => {
      this.stopInProgress = true
      if (reason === 'deleted') {
        this.deleted = true
      }
      this.clearIdleTimer()
      this.state = 'stopping'
      this.fanout.closeAll(reason)
      for (const [sessionId, session] of this.sessions) {
        session.close(reason)
        this.sessions.delete(sessionId)
      }
      if (this.runner) {
        await this.runner.stop(this.stopGraceMs)
        this.runner = undefined
      }
      this.state = 'idle'
    })().finally(() => {
      this.stopInProgress = false
      this.stopPromise = undefined
    })

    await this.stopPromise
  }

  snapshotStatus(): StreamStatusResponse {
    return {
      streamId: this.streamId,
      state: this.state,
      viewerCount: this.sessions.size,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      lastActiveAt: this.lastActiveAt,
      effectiveConfig: {
        transport: this.req.transport,
        video: this.req.video,
        audio: this.req.audio,
      },
      stats: {
        bytesOut: this.bytesOut,
        ffmpegPid: this.runner?.pid(),
        startAttempts: this.startAttempts,
        startLatencyMs: this.startLatencyMs,
        lastErrorAt: this.lastErrorAt,
      },
      recentError: this.recentError,
    }
  }

  private clearIdleTimer(): void {
    if (!this.idleTimer) {
      return
    }
    clearTimeout(this.idleTimer)
    this.idleTimer = undefined
  }
}
