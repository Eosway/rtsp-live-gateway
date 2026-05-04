import type { ApiErrorBody, FfmpegDiagnosticErrorDetail, FfmpegExitedErrorDetail, StreamState, StreamStatusResponse } from '@eosway/rtsp-live-gateway-protocol'
import { ApiError } from '../errors.js'
import { maskRtspUrlsInText, nowIso } from '../lib/index.js'
import { buildFfmpegCommand, resolveVideoPlan } from '../infra/ffmpeg/FFmpegCommandBuilder.js'
import { FFmpegRunner } from '../infra/ffmpeg/FFmpegRunner.js'
import { FFmpegStderrParser, type FFmpegDiagEvent, summarizeStderrTail, toDiagnosticDetail } from '../infra/ffmpeg/FFmpegStderrParser.js'
import { FlvBootstrapCache, FlvGopCache, FlvStreamParser } from '../infra/flv/FlvStreamParser.js'
import type { NormalizedStreamCreateRequest } from '../types.js'
import { FanoutHub } from './FanoutHub.js'
import { PlaybackSession } from './PlaybackSession.js'

interface StreamSourceOptions {
  streamId: string
  sourceKey: string
  req: NormalizedStreamCreateRequest
  ffmpegPath: string
  decoder: 'auto' | 'software' | 'hardware'
  encoder: 'auto' | 'software' | 'hardware'
  hardwareVendor: 'nvidia'
  startupTimeoutMs: number
  idleGraceMs: number
  stopGraceMs: number
  maxStartAttempts: number
  logger: {
    info(message: string, detail?: Record<string, unknown>): void
    warn(message: string, detail?: Record<string, unknown>): void
    error(message: string, detail?: Record<string, unknown>): void
  }
  gopCacheMaxBytes?: number
  runnerFactory?: () => FFmpegRunner
}

export class StreamSource {
  readonly streamId: string
  readonly sourceKey: string
  readonly createdAt: string
  readonly req: NormalizedStreamCreateRequest

  private readonly ffmpegPath: string
  private readonly decoder: 'auto' | 'software' | 'hardware'
  private readonly encoder: 'auto' | 'software' | 'hardware'
  private readonly hardwareVendor: 'nvidia'
  private readonly startupTimeoutMs: number
  private readonly idleGraceMs: number
  private readonly stopGraceMs: number
  private readonly maxStartAttempts: number
  private readonly logger: StreamSourceOptions['logger']
  private readonly runnerFactory: () => FFmpegRunner
  private readonly gopCache: FlvGopCache

  private state: StreamState = 'idle'
  private readonly sessions = new Map<string, PlaybackSession>()
  private readonly fanout = new FanoutHub()
  private readonly stderrParser = new FFmpegStderrParser()
  private readonly flvParser = new FlvStreamParser()
  private readonly bootstrapCache = new FlvBootstrapCache()
  private stderrRing: string[] = []
  private pendingSessions = new Map<string, PlaybackSession>()

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
  private lastDiagEvent?: FFmpegDiagEvent

  constructor(options: StreamSourceOptions) {
    this.streamId = options.streamId
    this.sourceKey = options.sourceKey
    this.req = options.req
    this.ffmpegPath = options.ffmpegPath
    this.decoder = options.decoder
    this.encoder = options.encoder
    this.hardwareVendor = options.hardwareVendor
    this.startupTimeoutMs = options.startupTimeoutMs
    this.idleGraceMs = options.idleGraceMs
    this.stopGraceMs = options.stopGraceMs
    this.maxStartAttempts = options.maxStartAttempts
    this.logger = options.logger
    this.runnerFactory = options.runnerFactory ?? (() => new FFmpegRunner())
    this.gopCache = new FlvGopCache(options.gopCacheMaxBytes ?? 512 * 1024)
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
    this.pendingSessions.set(session.sessionId, session)
    this.lastActiveAt = nowIso()
  }

  removeViewer(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }
    session.close(reason)
    this.fanout.unsubscribe(sessionId, reason)
    this.pendingSessions.delete(sessionId)
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
      const runner = this.runnerFactory()
      this.runner = runner
      const videoPlan = resolveVideoPlan(this.req, attempt)
      const command = buildFfmpegCommand(this.ffmpegPath, this.req, videoPlan, {
        decoder: this.decoder,
        encoder: this.encoder,
        hardwareVendor: this.hardwareVendor,
      })
      let firstChunkSeen = false
      let settled = false
      this.resetStreamCaches()

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
        let units
        try {
          units = this.flvParser.push(chunk)
        } catch {
          clearTimeout(startupTimer)
          void runner.stop(this.stopGraceMs).finally(() => {
            settleReject(
              new ApiError('NO_MEDIA_OUTPUT', 'Invalid FLV output from FFmpeg', {
                ts: Date.now(),
                level: 'error',
              })
            )
          })
          return
        }

        for (const unit of units) {
          if (!firstChunkSeen) {
            firstChunkSeen = true
            clearTimeout(startupTimer)
            settleResolve()
          }
          if (unit.kind === 'header') {
            this.bootstrapCache.observe(unit)
            this.bytesOut += unit.bytes.byteLength
            this.activatePendingSessions()
            continue
          }

          this.activatePendingSessions()
          this.bootstrapCache.observe(unit)
          this.gopCache.observe(unit)
          this.bytesOut += unit.bytes.byteLength
          this.fanout.publish(unit.bytes)
        }
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
          settleReject(this.buildStartupExitError(code, signal))
          return
        }
        if (!this.stopInProgress && !this.deleted) {
          this.state = 'error'
          this.lastErrorAt = nowIso()
          const detail: FfmpegExitedErrorDetail = {
            reason: 'exit_while_running',
            summary: 'FFmpeg exited while running',
            code,
            signal,
            stderrTail: summarizeStderrTail(this.stderrRing.slice(-10)),
          }
          this.recentError = {
            code: 'FFMPEG_EXITED',
            message: 'FFmpeg exited while running',
            detail,
          }
          this.fanout.closeAll('ffmpeg_exited')
        }
      })

      runner.onError(() => {
        clearTimeout(startupTimer)
        const detail = this.buildProcessErrorDetail()
        settleReject(new ApiError('FFMPEG_NOT_FOUND', 'FFmpeg process error before media output', detail))
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
        const detail = this.buildProcessErrorDetail()
        settleReject(new ApiError('FFMPEG_NOT_FOUND', 'Failed to spawn ffmpeg process', detail))
      }
    })
  }

  private pushStderr(line: string): void {
    this.stderrRing.push(maskRtspUrlsInText(line))
    if (this.stderrRing.length > 50) {
      this.stderrRing = this.stderrRing.slice(-50)
    }
  }

  private applyDiagEvent(event: FFmpegDiagEvent): void {
    this.lastDiagEvent = event
    const detail = toDiagnosticDetail(event)
    this.recentError = {
      code: event.code,
      message: event.summary,
      detail,
    }
    this.lastErrorAt = nowIso()
  }

  private buildStartupExitError(code: number | null, signal: NodeJS.Signals | null): ApiError {
    const diag = this.lastDiagEvent
    if (diag) {
      const detail: FfmpegExitedErrorDetail = {
        reason: diag.reason ?? 'exit_before_output',
        summary: diag.summary,
        code,
        signal,
        stderrTail: summarizeStderrTail(this.stderrRing.slice(-10)),
      }
      return new ApiError(diag.code, diag.summary, detail)
    }

    const detail: FfmpegExitedErrorDetail = {
      reason: 'exit_before_output',
      summary: 'FFmpeg exited before first media chunk',
      code,
      signal,
      stderrTail: summarizeStderrTail(this.stderrRing.slice(-10)),
    }
    return new ApiError('FFMPEG_EXITED', 'FFmpeg exited before first media chunk', detail)
  }

  private buildProcessErrorDetail(): FfmpegDiagnosticErrorDetail {
    return {
      reason: 'process_error',
      summary: 'FFmpeg process error before media output',
      stderrTail: summarizeStderrTail(this.stderrRing.slice(-10)),
    }
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
      for (const [sessionId, session] of this.pendingSessions) {
        session.close(reason)
        this.pendingSessions.delete(sessionId)
      }
      for (const [sessionId, session] of this.sessions) {
        session.close(reason)
        this.sessions.delete(sessionId)
      }
      if (this.runner) {
        await this.runner.stop(this.stopGraceMs)
        this.runner = undefined
      }
      this.resetStreamCaches()
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

  private activatePendingSessions(): void {
    if (this.pendingSessions.size === 0) {
      return
    }
    const bootstrap = this.bootstrapCache.snapshot()
    if (!bootstrap) {
      return
    }
    const gop = this.gopCache.snapshot() ?? []
    const preload = [...bootstrap, ...gop]
    for (const [sessionId, session] of this.pendingSessions) {
      this.pendingSessions.delete(sessionId)
      this.fanout.activate(session, preload)
      if (session.isClosed()) {
        this.sessions.delete(sessionId)
      }
    }
  }

  private resetStreamCaches(): void {
    this.flvParser.reset()
    this.bootstrapCache.reset()
    this.gopCache.reset()
  }
}
