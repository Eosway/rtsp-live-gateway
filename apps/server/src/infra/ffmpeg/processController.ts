import type { ApiErrorBody, FfmpegDiagnosticErrorDetail, FfmpegExitedErrorDetail } from '@eosway/rtsp-live-gateway-protocol'
import { ApiError } from '../../errors.js'
import type { ProbedInputMedia, ResolvedAudioPlan, ResolvedStreamCreateRequest } from '../../types.js'
import { maskRtspUrlsInText } from '../../util/sanitize.js'
import { buildFfmpegCommand, resolveAudioPlan, resolveVideoPlan, type FFmpegCommand, type VideoPlan } from './command.js'
import { FFprobeRunner } from './probe.js'
import { FFmpegRunner } from './runner.js'
import { FFmpegStderrParser, type FFmpegDiagEvent, summarizeStderrTail } from './stderr.js'

interface ProcessControllerOptions {
  ffmpegPath: string
  ffprobePath?: string
  ioTimeoutMs: number
  decoder: 'auto' | 'software' | 'hardware'
  encoder: 'auto' | 'software' | 'hardware'
  hardwareVendor: 'nvidia'
  startupTimeoutMs: number
  stopGraceMs: number
  runnerFactory?: () => FFmpegRunner
}

interface StartInput {
  req: ResolvedStreamCreateRequest
  attempt: number
  inputMedia: ProbedInputMedia
  onChunk(chunk: Uint8Array): boolean
  onDiagEvent(event: FFmpegDiagEvent): void
  onRuntimeExit(error: ApiErrorBody): void
}

export interface StartedProcess {
  inputMedia: ProbedInputMedia
  videoPlan: VideoPlan
  audioPlan: ResolvedAudioPlan
  command: FFmpegCommand
}

export class ProcessController {
  private readonly ffmpegPath: string
  private readonly ioTimeoutMs: number
  private readonly ffprobeRunner?: FFprobeRunner
  private readonly decoder: 'auto' | 'software' | 'hardware'
  private readonly encoder: 'auto' | 'software' | 'hardware'
  private readonly hardwareVendor: 'nvidia'
  private readonly startupTimeoutMs: number
  private readonly stopGraceMs: number
  private readonly runnerFactory: () => FFmpegRunner
  private readonly stderrParser = new FFmpegStderrParser()

  private runner?: FFmpegRunner
  private stopPromise?: Promise<void>
  private stopping = false
  private stderrRing: string[] = []
  private lastDiagEvent?: FFmpegDiagEvent

  constructor(options: ProcessControllerOptions) {
    this.ffmpegPath = options.ffmpegPath
    this.ioTimeoutMs = options.ioTimeoutMs
    this.ffprobeRunner = options.ffprobePath ? new FFprobeRunner(options.ffprobePath) : undefined
    this.decoder = options.decoder
    this.encoder = options.encoder
    this.hardwareVendor = options.hardwareVendor
    this.startupTimeoutMs = options.startupTimeoutMs
    this.stopGraceMs = options.stopGraceMs
    this.runnerFactory = options.runnerFactory ?? (() => new FFmpegRunner())
  }

  async start(input: StartInput): Promise<StartedProcess> {
    this.stopping = false
    this.stderrRing = []
    this.lastDiagEvent = undefined

    const inputMedia = input.inputMedia
    const videoPlan = resolveVideoPlan(input.attempt, input.req.video.mode, input.req.video.codec, inputMedia.video)
    const audioPlan = resolveAudioPlan(input.req, inputMedia.audio)
    const command = buildFfmpegCommand(this.ffmpegPath, input.req, videoPlan, audioPlan, inputMedia.video, {
      ioTimeoutMs: this.ioTimeoutMs,
      decoder: this.decoder,
      encoder: this.encoder,
      hardwareVendor: this.hardwareVendor,
    })

    await new Promise<void>((resolve, reject) => {
      const runner = this.runnerFactory()
      this.runner = runner
      let firstMediaSeen = false
      let settled = false

      const settleReject = (error: ApiError) => {
        if (settled) {
          return
        }
        settled = true
        reject(error)
      }

      const settleResolve = () => {
        if (settled) {
          return
        }
        settled = true
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
        try {
          const seenInChunk = input.onChunk(chunk)
          if (seenInChunk && !firstMediaSeen) {
            firstMediaSeen = true
            clearTimeout(startupTimer)
            settleResolve()
          }
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
        }
      })

      runner.onStderrLine((line) => {
        this.pushStderr(line)
        const diag = this.stderrParser.parse(line)
        if (!diag) {
          return
        }
        this.lastDiagEvent = diag
        input.onDiagEvent(diag)
      })

      runner.onExit((code, signal) => {
        clearTimeout(startupTimer)
        if (!firstMediaSeen) {
          settleReject(this.buildStartupExitError(code, signal))
          return
        }
        if (this.stopping) {
          return
        }

        const detail: FfmpegExitedErrorDetail = {
          reason: 'exit_while_running',
          summary: 'FFmpeg exited while running',
          code,
          signal,
          stderrTail: summarizeStderrTail(this.stderrRing.slice(-10)),
        }
        input.onRuntimeExit({
          code: 'FFMPEG_EXITED',
          message: 'FFmpeg exited while running',
          detail,
        })
      })

      runner.onError(() => {
        clearTimeout(startupTimer)
        settleReject(new ApiError('FFMPEG_NOT_FOUND', 'FFmpeg process error before media output', this.buildProcessErrorDetail()))
      })

      try {
        runner.start(command)
      } catch {
        clearTimeout(startupTimer)
        settleReject(new ApiError('FFMPEG_NOT_FOUND', 'Failed to spawn ffmpeg process', this.buildProcessErrorDetail()))
      }
    })

    return {
      inputMedia,
      videoPlan,
      audioPlan,
      command,
    }
  }

  async stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise
    }

    this.stopping = true
    this.stopPromise = (async () => {
      if (!this.runner) {
        return
      }
      await this.runner.stop(this.stopGraceMs)
      this.runner = undefined
    })().finally(() => {
      this.stopPromise = undefined
    })

    await this.stopPromise
  }

  pid(): number | undefined {
    return this.runner?.pid()
  }

  private pushStderr(line: string): void {
    this.stderrRing.push(maskRtspUrlsInText(line))
    if (this.stderrRing.length > 50) {
      this.stderrRing = this.stderrRing.slice(-50)
    }
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

  async probeInputMedia(req: ResolvedStreamCreateRequest): Promise<ProbedInputMedia> {
    if (!this.ffprobeRunner) {
      return {
        video: 'unknown',
        audio: 'unknown',
      }
    }

    try {
      const input = {
        transport: req.transport,
        ioTimeoutMs: this.ioTimeoutMs,
        url: req.url,
      }
      const [video, audio] = await Promise.all([this.ffprobeRunner.probeVideoCodec(input), this.ffprobeRunner.probeAudioCodec(input)])
      return { video, audio }
    } catch {
      return {
        video: 'unknown',
        audio: 'unknown',
      }
    }
  }
}
