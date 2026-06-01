import type { ApiErrorBody, StreamState, StreamStatusResponse } from '@eosway/rtsp-live-gateway-protocol'
import { ApiError } from '../errors.js'
import { ProcessController } from '../infra/ffmpeg/processController.js'
import { FanoutPipeline } from '../infra/flv/fanoutPipeline.js'
import { FFmpegRunner } from '../infra/ffmpeg/runner.js'
import { type FFmpegDiagEvent, toDiagnosticDetail } from '../infra/ffmpeg/stderr.js'
import type { ProbedInputMedia, ResolvedStreamCreateRequest } from '../types.js'
import { nowIso } from '../util/time.js'
import { PlaybackSession } from './playbackSession.js'
import { toStreamStatusResponse } from './snapshot.js'

interface StreamSourceOptions {
  streamId: string
  sourceKey: string
  req: ResolvedStreamCreateRequest
  ffmpegPath: string
  ioTimeoutMs: number
  ffprobePath?: string
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
  readonly req: ResolvedStreamCreateRequest

  private readonly ffmpegPath: string
  private readonly ioTimeoutMs: number
  private readonly ffprobePath?: string
  private readonly decoder: 'auto' | 'software' | 'hardware'
  private readonly encoder: 'auto' | 'software' | 'hardware'
  private readonly hardwareVendor: 'nvidia'
  private readonly startupTimeoutMs: number
  private readonly idleGraceMs: number
  private readonly stopGraceMs: number
  private readonly maxStartAttempts: number
  private readonly logger: StreamSourceOptions['logger']
  private readonly processController: ProcessController

  private state: StreamState = 'idle'
  private readonly sessions = new Map<string, PlaybackSession>()
  private readonly pipeline: FanoutPipeline

  private startPromise?: Promise<void>
  private stopPromise?: Promise<void>
  private idleTimer?: NodeJS.Timeout
  private stopInProgress = false
  private deleted = false

  private startedAt?: string
  private lastActiveAt?: string
  private bytesOutTotal = 0
  private startAttemptsTotal = 0
  private lastStartLatencyMs?: number
  private lastErrorAt?: string
  private recentError?: ApiErrorBody

  constructor(options: StreamSourceOptions) {
    this.streamId = options.streamId
    this.sourceKey = options.sourceKey
    this.req = options.req
    this.ffmpegPath = options.ffmpegPath
    this.ioTimeoutMs = options.ioTimeoutMs
    this.ffprobePath = options.ffprobePath
    this.decoder = options.decoder
    this.encoder = options.encoder
    this.hardwareVendor = options.hardwareVendor
    this.startupTimeoutMs = options.startupTimeoutMs
    this.idleGraceMs = options.idleGraceMs
    this.stopGraceMs = options.stopGraceMs
    this.maxStartAttempts = options.maxStartAttempts
    this.logger = options.logger
    this.pipeline = new FanoutPipeline({
      gopCacheMaxBytes: options.gopCacheMaxBytes ?? 512 * 1024,
    })
    this.processController = new ProcessController({
      ffmpegPath: this.ffmpegPath,
      ffprobePath: this.ffprobePath,
      ioTimeoutMs: this.ioTimeoutMs,
      decoder: this.decoder,
      encoder: this.encoder,
      hardwareVendor: this.hardwareVendor,
      startupTimeoutMs: this.startupTimeoutMs,
      stopGraceMs: this.stopGraceMs,
      runnerFactory: options.runnerFactory,
    })
    this.createdAt = nowIso()
    this.lastActiveAt = this.createdAt
  }

  protected probeInputMedia(): Promise<ProbedInputMedia> {
    return this.processController.probeInputMedia(this.req)
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
    this.pipeline.addPendingSession(session)
    this.lastActiveAt = nowIso()
  }

  removeViewer(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }
    session.close(reason)
    this.pipeline.unsubscribe(sessionId, reason)
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

  private async startOnce(trigger: 'first_viewer' | 'manual', attempt: number): Promise<void> {
    this.startAttemptsTotal += 1
    this.state = 'starting'
    const startAtMs = Date.now()
    this.pipeline.reset()

    try {
      const inputMedia = await this.probeInputMedia()
      const started = await this.processController.start({
        req: this.req,
        attempt,
        inputMedia,
        onChunk: (chunk) => {
          const result = this.pipeline.publish(chunk)
          for (const sessionId of result.closedSessionIds) {
            this.sessions.delete(sessionId)
          }

          if (result.bytesOutDelta > 0) {
            this.bytesOutTotal += result.bytesOutDelta
          }

          return result.firstMediaSeen
        },
        onDiagEvent: (event) => {
          this.applyDiagEvent(event)
        },
        onRuntimeExit: (error) => {
          if (this.stopInProgress || this.deleted) {
            return
          }
          this.state = 'error'
          this.lastErrorAt = nowIso()
          this.recentError = error
          this.pipeline.closeAll('ffmpeg_exited')
        },
      })

      this.state = 'running'
      this.startedAt = nowIso()
      this.lastStartLatencyMs = Date.now() - startAtMs
      this.logger.info('ffmpeg_spawned', {
        streamId: this.streamId,
        trigger,
        attempt,
        inputVideoCodec: started.inputMedia.video,
        inputAudioCodec: started.inputMedia.audio,
        videoPlan: started.videoPlan,
        audioPlan: started.audioPlan,
        command: started.command.safePreview,
      })
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('FFMPEG_EXITED', error instanceof Error ? error.message : 'FFmpeg exited before media output')
      this.recentError = apiError.toBody()
      this.lastErrorAt = nowIso()
      this.state = 'error'
      throw apiError
    }
  }

  private applyDiagEvent(event: FFmpegDiagEvent): void {
    const detail = toDiagnosticDetail(event)
    this.recentError = {
      code: event.code,
      message: event.summary,
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
      this.pipeline.closeAll(reason)
      for (const [sessionId, session] of this.sessions) {
        session.close(reason)
        this.sessions.delete(sessionId)
      }
      await this.processController.stop()
      this.pipeline.reset()
      this.state = 'idle'
    })().finally(() => {
      this.stopInProgress = false
      this.stopPromise = undefined
    })

    await this.stopPromise
  }

  snapshotStatus(): StreamStatusResponse {
    return toStreamStatusResponse({
      streamId: this.streamId,
      state: this.state,
      viewerCount: this.sessions.size,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      lastActiveAt: this.lastActiveAt,
      req: this.req,
      bytesOutTotal: this.bytesOutTotal,
      currentFfmpegPid: this.processController.pid(),
      startAttemptsTotal: this.startAttemptsTotal,
      lastStartLatencyMs: this.lastStartLatencyMs,
      lastErrorAt: this.lastErrorAt,
      recentError: this.recentError,
    })
  }

  private clearIdleTimer(): void {
    if (!this.idleTimer) {
      return
    }
    clearTimeout(this.idleTimer)
    this.idleTimer = undefined
  }
}
