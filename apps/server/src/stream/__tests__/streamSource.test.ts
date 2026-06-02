import { expect, test } from 'vitest'
import type { FFmpegCommand } from '../../infra/ffmpeg/command.js'
import type { Logger } from '../../util/logger.js'
import type { ResolvedStreamCreateRequest } from '../../types.js'
import { PlaybackSession } from '../playbackSession.js'
import { StreamSource } from '../streamSource.js'

class FakeRunner {
  private stdoutListeners: Array<(chunk: Uint8Array) => void> = []
  private stderrListeners: Array<(line: string) => void> = []
  private exitListeners: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = []
  private errorListeners: Array<(error: Error) => void> = []
  private stopped = false

  public command?: FFmpegCommand

  start(command?: FFmpegCommand): void {
    this.command = command
  }

  onStdout(listener: (chunk: Uint8Array) => void): void {
    this.stdoutListeners.push(listener)
  }

  onStderrLine(listener: (line: string) => void): void {
    this.stderrListeners.push(listener)
  }

  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void {
    this.exitListeners.push(listener)
  }

  onError(listener: (error: Error) => void): void {
    this.errorListeners.push(listener)
  }

  emitStdout(chunk: Uint8Array): void {
    for (const listener of this.stdoutListeners) {
      listener(chunk)
    }
  }

  emitStderrLine(line: string): void {
    for (const listener of this.stderrListeners) {
      listener(line)
    }
  }

  emitExit(code: number | null, signal: NodeJS.Signals | null): void {
    for (const listener of this.exitListeners) {
      listener(code, signal)
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
  }

  pid(): number | undefined {
    return this.stopped ? undefined : 1234
  }
}

function createLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }
}

function createRequest(): ResolvedStreamCreateRequest {
  return {
    url: 'rtsp://example.com/live',
    transport: 'tcp',
    video: {
      mode: 'auto',
      fallbackCodec: 'h264',
    },
    audio: {
      enabled: false,
    },
  }
}

function createSource(fakeRunners: FakeRunner[], overrides: { gopCacheMaxBytes?: number } = {}): StreamSource {
  return new StreamSource({
    streamId: 'st_test',
    sourceKey: 'src_test',
    req: createRequest(),
    ffmpegPath: '/usr/bin/ffmpeg',
    ioTimeoutMs: 5000,
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
    startupTimeoutMs: 1000,
    idleGraceMs: 1000,
    stopGraceMs: 100,
    maxStartAttempts: 1,
    logger: createLogger(),
    gopCacheMaxBytes: overrides.gopCacheMaxBytes,
    runnerFactory: () => {
      const nextRunner = fakeRunners.shift()
      if (!nextRunner) {
        throw new Error('expected fake runner')
      }
      return nextRunner as never
    },
  })
}

function createSession(sessionId: string): PlaybackSession {
  const session = new PlaybackSession({
    streamId: 'st_test',
    maxQueueBytes: 1024 * 1024,
  })
  Object.defineProperty(session, 'sessionId', {
    value: sessionId,
    configurable: true,
  })
  return session
}

function createFlvHeader(): Uint8Array {
  return Uint8Array.from([0x46, 0x4c, 0x56, 0x01, 0x01, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00])
}

function createFlvTag(tagType: number, body: number[]): Uint8Array {
  const dataSize = body.length
  const tagSize = 11 + dataSize + 4
  const bytes = new Uint8Array(tagSize)
  bytes[0] = tagType
  bytes[1] = (dataSize >> 16) & 0xff
  bytes[2] = (dataSize >> 8) & 0xff
  bytes[3] = dataSize & 0xff
  bytes.set(body, 11)
  const previousTagSize = 11 + dataSize
  const tail = 11 + dataSize
  bytes[tail] = (previousTagSize >> 24) & 0xff
  bytes[tail + 1] = (previousTagSize >> 16) & 0xff
  bytes[tail + 2] = (previousTagSize >> 8) & 0xff
  bytes[tail + 3] = previousTagSize & 0xff
  return bytes
}

function createVideoSequenceHeaderTag(): Uint8Array {
  return createFlvTag(9, [0x17, 0x00, 0x00, 0x00, 0x00, 0x01])
}

function createVideoInterFrameTag(): Uint8Array {
  return createFlvTag(9, [0x27, 0x01, 0x00, 0x00, 0x00, 0x02])
}

function createVideoKeyframeTag(marker = 0x03): Uint8Array {
  return createFlvTag(9, [0x17, 0x01, 0x00, 0x00, 0x00, marker])
}

function createAudioFrameTag(marker = 0x04): Uint8Array {
  return createFlvTag(8, [0xaf, 0x01, marker])
}

async function drainSession(session: PlaybackSession, chunkCount: number): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = []
  const drainPromise = session.drain(async (chunk) => {
    chunks.push(chunk)
    if (chunks.length >= chunkCount) {
      session.close('test_done')
    }
  })
  await drainPromise
  return chunks
}

async function nextTick(): Promise<void> {
  await Promise.resolve()
}

test('running source should bootstrap late viewer at next tag boundary', async () => {
  const fakeRunner = new FakeRunner()
  const source = createSource([fakeRunner])
  const firstViewer = createSession('se_first')
  source.addViewer(firstViewer)

  const startPromise = source.ensureStarted('first_viewer')
  const header = createFlvHeader()
  const sequence = createVideoSequenceHeaderTag()
  const keyframe = createVideoKeyframeTag()
  await nextTick()
  fakeRunner.emitStdout(header)
  fakeRunner.emitStdout(sequence)
  fakeRunner.emitStdout(keyframe)
  await startPromise

  const firstChunks = await drainSession(firstViewer, 3)
  expect(firstChunks).toEqual([header, sequence, keyframe])

  const lateViewer = createSession('se_late')
  source.addViewer(lateViewer)
  const lateDrainPromise = drainSession(lateViewer, 4)

  const interFrame = createVideoInterFrameTag()
  fakeRunner.emitStdout(interFrame)

  const lateChunks = await lateDrainPromise
  expect(lateChunks).toEqual([header, sequence, keyframe, interFrame])
})

test('stream restart should rebuild bootstrap instead of reusing stale prefix', async () => {
  const firstRunner = new FakeRunner()
  const secondRunner = new FakeRunner()
  const source = createSource([firstRunner, secondRunner])
  const firstViewer = createSession('se_restart_first')
  source.addViewer(firstViewer)

  const firstStartPromise = source.ensureStarted('first_viewer')
  const firstHeader = createFlvHeader()
  const firstSequence = createVideoSequenceHeaderTag()
  const firstKeyframe = createVideoKeyframeTag()
  await nextTick()
  firstRunner.emitStdout(firstHeader)
  firstRunner.emitStdout(firstSequence)
  firstRunner.emitStdout(firstKeyframe)
  await firstStartPromise
  await source.stop('idle_timeout')

  const secondViewer = createSession('se_restart_second')
  source.addViewer(secondViewer)
  const secondStartPromise = source.ensureStarted('first_viewer')
  const secondHeader = createFlvHeader()
  const secondSequence = createFlvTag(9, [0x17, 0x00, 0x00, 0x00, 0x00, 0x09])
  const secondKeyframe = createVideoKeyframeTag(0x19)
  await nextTick()
  secondRunner.emitStdout(secondHeader)
  secondRunner.emitStdout(secondSequence)
  secondRunner.emitStdout(secondKeyframe)
  await secondStartPromise

  const secondChunks = await drainSession(secondViewer, 3)
  expect(secondChunks).toEqual([secondHeader, secondSequence, secondKeyframe])
})

test('late viewer should receive latest gop before live tags', async () => {
  const fakeRunner = new FakeRunner()
  const source = createSource([fakeRunner])
  const firstViewer = createSession('se_gop_first')
  source.addViewer(firstViewer)

  const startPromise = source.ensureStarted('first_viewer')
  const header = createFlvHeader()
  const sequence = createVideoSequenceHeaderTag()
  const oldKeyframe = createVideoKeyframeTag(0x11)
  const oldInterFrame = createVideoInterFrameTag()
  const newKeyframe = createVideoKeyframeTag(0x22)
  const newAudio = createAudioFrameTag(0x33)
  const liveInterFrame = createFlvTag(9, [0x27, 0x01, 0x00, 0x00, 0x00, 0x44])

  await nextTick()
  fakeRunner.emitStdout(header)
  fakeRunner.emitStdout(sequence)
  fakeRunner.emitStdout(oldKeyframe)
  fakeRunner.emitStdout(oldInterFrame)
  fakeRunner.emitStdout(newKeyframe)
  fakeRunner.emitStdout(newAudio)
  await startPromise

  const lateViewer = createSession('se_gop_late')
  source.addViewer(lateViewer)
  const lateDrainPromise = drainSession(lateViewer, 5)

  fakeRunner.emitStdout(liveInterFrame)

  const lateChunks = await lateDrainPromise
  expect(lateChunks).toEqual([header, sequence, newKeyframe, newAudio, liveInterFrame])
})

test('gop cache overflow should wait for next keyframe before rebuilding cache', async () => {
  const fakeRunner = new FakeRunner()
  const source = createSource([fakeRunner], { gopCacheMaxBytes: 30 })
  const firstViewer = createSession('se_overflow_first')
  source.addViewer(firstViewer)

  const startPromise = source.ensureStarted('first_viewer')
  const header = createFlvHeader()
  const sequence = createVideoSequenceHeaderTag()
  const largeKeyframe = createVideoKeyframeTag(0x55)
  const largeInterFrame = createFlvTag(9, [0x27, 0x01, 0x00, 0x00, 0x00, 0x66, 0x67, 0x68, 0x69, 0x6a])
  await nextTick()
  fakeRunner.emitStdout(header)
  fakeRunner.emitStdout(sequence)
  fakeRunner.emitStdout(largeKeyframe)
  fakeRunner.emitStdout(largeInterFrame)
  await startPromise

  const lateViewerBeforeReset = createSession('se_overflow_before_reset')
  source.addViewer(lateViewerBeforeReset)
  const beforeResetDrainPromise = drainSession(lateViewerBeforeReset, 3)

  const nextKeyframe = createVideoKeyframeTag(0x77)
  fakeRunner.emitStdout(nextKeyframe)

  const beforeResetChunks = await beforeResetDrainPromise
  expect(beforeResetChunks).toEqual([header, sequence, nextKeyframe])

  const lateViewerAfterReset = createSession('se_overflow_after_reset')
  source.addViewer(lateViewerAfterReset)
  const afterResetDrainPromise = drainSession(lateViewerAfterReset, 4)

  const audioAfterReset = createAudioFrameTag(0x88)
  fakeRunner.emitStdout(audioAfterReset)

  const afterResetChunks = await afterResetDrainPromise
  expect(afterResetChunks).toEqual([header, sequence, nextKeyframe, audioAfterReset])
})

test('first start should copy when probed codec matches requested output codec', async () => {
  const fakeRunner = new FakeRunner()
  const source = new StreamSource({
    streamId: 'st_auto_copy',
    sourceKey: 'src_auto_copy',
    req: createRequest(),
    ffmpegPath: '/usr/bin/ffmpeg',
    ioTimeoutMs: 5000,
    ffprobePath: '/usr/bin/ffprobe',
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
    startupTimeoutMs: 1000,
    idleGraceMs: 1000,
    stopGraceMs: 100,
    maxStartAttempts: 1,
    logger: createLogger(),
    runnerFactory: () => fakeRunner as never,
  })
  ;(source as unknown as { probeInputMedia(): Promise<{ video: 'h264'; audio: 'unknown' }> }).probeInputMedia = async () => ({
    video: 'h264',
    audio: 'unknown',
  })

  const viewer = createSession('se_auto_copy')
  source.addViewer(viewer)

  const startPromise = source.ensureStarted('first_viewer')
  await nextTick()
  fakeRunner.emitStdout(createFlvHeader())
  fakeRunner.emitStdout(createVideoSequenceHeaderTag())
  fakeRunner.emitStdout(createVideoKeyframeTag())
  await startPromise

  const command = fakeRunner.command
  if (!command) {
    throw new Error('expected ffmpeg command')
  }
  expect(command.args[command.args.indexOf('-c:v') + 1]).toBe('copy')
})

test('first start should transcode when probed codec differs from requested output codec', async () => {
  const fakeRunner = new FakeRunner()
  const source = new StreamSource({
    streamId: 'st_auto_transcode',
    sourceKey: 'src_auto_transcode',
    req: {
      ...createRequest(),
      video: {
        mode: 'auto',
        codec: 'h264',
        fallbackCodec: 'h264',
      },
    },
    ffmpegPath: '/usr/bin/ffmpeg',
    ioTimeoutMs: 5000,
    ffprobePath: '/usr/bin/ffprobe',
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
    startupTimeoutMs: 1000,
    idleGraceMs: 1000,
    stopGraceMs: 100,
    maxStartAttempts: 1,
    logger: createLogger(),
    runnerFactory: () => fakeRunner as never,
  })
  ;(source as unknown as { probeInputMedia(): Promise<{ video: 'h265'; audio: 'unknown' }> }).probeInputMedia = async () => ({
    video: 'h265',
    audio: 'unknown',
  })

  const viewer = createSession('se_auto_transcode')
  source.addViewer(viewer)

  const startPromise = source.ensureStarted('first_viewer')
  await nextTick()
  fakeRunner.emitStdout(createFlvHeader())
  fakeRunner.emitStdout(createVideoSequenceHeaderTag())
  fakeRunner.emitStdout(createVideoKeyframeTag())
  await startPromise

  const command = fakeRunner.command
  if (!command) {
    throw new Error('expected ffmpeg command')
  }
  expect(command.args[command.args.indexOf('-c:v') + 1]).not.toBe('copy')
})

test('audio auto should copy when probed input audio codec is aac', async () => {
  const fakeRunner = new FakeRunner()
  const source = new StreamSource({
    streamId: 'st_audio_auto_copy',
    sourceKey: 'src_audio_auto_copy',
    req: {
      ...createRequest(),
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'aac',
      },
    },
    ffmpegPath: '/usr/bin/ffmpeg',
    ioTimeoutMs: 5000,
    ffprobePath: '/usr/bin/ffprobe',
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
    startupTimeoutMs: 1000,
    idleGraceMs: 1000,
    stopGraceMs: 100,
    maxStartAttempts: 1,
    logger: createLogger(),
    runnerFactory: () => fakeRunner as never,
  })
  ;(source as unknown as { probeInputMedia(): Promise<{ video: 'h264'; audio: 'aac' }> }).probeInputMedia = async () => ({
    video: 'h264',
    audio: 'aac',
  })

  const viewer = createSession('se_audio_auto_copy')
  source.addViewer(viewer)

  const startPromise = source.ensureStarted('first_viewer')
  await nextTick()
  fakeRunner.emitStdout(createFlvHeader())
  fakeRunner.emitStdout(createVideoSequenceHeaderTag())
  fakeRunner.emitStdout(createVideoKeyframeTag())
  await startPromise

  const command = fakeRunner.command
  if (!command) {
    throw new Error('expected ffmpeg command')
  }
  expect(command.args[command.args.indexOf('-c:a') + 1]).toBe('copy')
})

test('audio auto should transcode unknown input audio codec', async () => {
  const fakeRunner = new FakeRunner()
  const source = new StreamSource({
    streamId: 'st_audio_auto_transcode',
    sourceKey: 'src_audio_auto_transcode',
    req: {
      ...createRequest(),
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'mp3',
      },
    },
    ffmpegPath: '/usr/bin/ffmpeg',
    ioTimeoutMs: 5000,
    ffprobePath: '/usr/bin/ffprobe',
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
    startupTimeoutMs: 1000,
    idleGraceMs: 1000,
    stopGraceMs: 100,
    maxStartAttempts: 1,
    logger: createLogger(),
    runnerFactory: () => fakeRunner as never,
  })
  ;(source as unknown as { probeInputMedia(): Promise<{ video: 'h264'; audio: 'unknown' }> }).probeInputMedia = async () => ({
    video: 'h264',
    audio: 'unknown',
  })

  const viewer = createSession('se_audio_auto_transcode')
  source.addViewer(viewer)

  const startPromise = source.ensureStarted('first_viewer')
  await nextTick()
  fakeRunner.emitStdout(createFlvHeader())
  fakeRunner.emitStdout(createVideoSequenceHeaderTag())
  fakeRunner.emitStdout(createVideoKeyframeTag())
  await startPromise

  const command = fakeRunner.command
  if (!command) {
    throw new Error('expected ffmpeg command')
  }
  expect(command.args[command.args.indexOf('-c:a') + 1]).toBe('libmp3lame')
})

test('snapshotStatus should expose cumulative and last-run stats with explicit semantics', async () => {
  const firstRunner = new FakeRunner()
  const secondRunner = new FakeRunner()
  const source = createSource([firstRunner, secondRunner])
  const firstViewer = createSession('se_stats_first')
  source.addViewer(firstViewer)

  const firstStartPromise = source.ensureStarted('first_viewer')
  const firstHeader = createFlvHeader()
  const firstSequence = createVideoSequenceHeaderTag()
  const firstKeyframe = createVideoKeyframeTag()
  await nextTick()
  firstRunner.emitStdout(firstHeader)
  firstRunner.emitStdout(firstSequence)
  firstRunner.emitStdout(firstKeyframe)
  await firstStartPromise

  const runningStatus = source.snapshotStatus()
  expect(runningStatus.startedAt).toBeTruthy()
  expect(runningStatus.lastActiveAt).toBeTruthy()
  expect(runningStatus.stats.bytesOutTotal).toBe(firstHeader.byteLength + firstSequence.byteLength + firstKeyframe.byteLength)
  expect(runningStatus.stats.startAttemptsTotal).toBe(1)
  expect(runningStatus.stats.currentFfmpegPid).toBe(1234)
  expect(runningStatus.stats.lastStartLatencyMs).toBeTypeOf('number')

  await source.stop('idle_timeout')

  const stoppedStatus = source.snapshotStatus()
  expect(stoppedStatus.stats.bytesOutTotal).toBe(firstHeader.byteLength + firstSequence.byteLength + firstKeyframe.byteLength)
  expect(stoppedStatus.stats.startAttemptsTotal).toBe(1)
  expect(stoppedStatus.stats.currentFfmpegPid).toBeUndefined()

  const secondViewer = createSession('se_stats_second')
  source.addViewer(secondViewer)
  const secondStartPromise = source.ensureStarted('first_viewer')
  const secondHeader = createFlvHeader()
  const secondSequence = createVideoSequenceHeaderTag()
  const secondKeyframe = createVideoKeyframeTag(0x15)
  await nextTick()
  secondRunner.emitStdout(secondHeader)
  secondRunner.emitStdout(secondSequence)
  secondRunner.emitStdout(secondKeyframe)
  await secondStartPromise

  const restartedStatus = source.snapshotStatus()
  expect(restartedStatus.stats.bytesOutTotal).toBe(
    firstHeader.byteLength +
      firstSequence.byteLength +
      firstKeyframe.byteLength +
      secondHeader.byteLength +
      secondSequence.byteLength +
      secondKeyframe.byteLength
  )
  expect(restartedStatus.stats.startAttemptsTotal).toBe(2)
  expect(restartedStatus.stats.currentFfmpegPid).toBe(1234)
  expect(restartedStatus.stats.lastStartLatencyMs).toBeTypeOf('number')
  expect(restartedStatus.startedAt).toBeTruthy()
  expect(restartedStatus.lastActiveAt).toBeTruthy()
})

test('ensureStarted should wait for first keyframe before resolving', async () => {
  const fakeRunner = new FakeRunner()
  const source = createSource([fakeRunner])
  const viewer = createSession('se_wait_keyframe')
  source.addViewer(viewer)

  let resolved = false
  const startPromise = source.ensureStarted('first_viewer').then(() => {
    resolved = true
  })

  await nextTick()
  fakeRunner.emitStdout(createFlvHeader())
  fakeRunner.emitStdout(createVideoSequenceHeaderTag())
  await nextTick()
  expect(resolved).toBe(false)

  fakeRunner.emitStdout(createVideoKeyframeTag())
  await startPromise
  expect(resolved).toBe(true)
})

test('startup failure should surface structured upstream_not_found error instead of generic ffmpeg_exited', async () => {
  const fakeRunner = new FakeRunner()
  const source = createSource([fakeRunner])
  const viewer = createSession('se_error_not_found')
  source.addViewer(viewer)

  const startPromise = source.ensureStarted('first_viewer')
  await nextTick()
  fakeRunner.onStderrLine(() => undefined)
  fakeRunner.emitStderrLine('Error opening input file rtsp://admin:secret@camera.local/live.')
  fakeRunner.emitStderrLine('[rtsp @ 0x7feabd0cc380] method OPTIONS failed: 404 Not Found')
  fakeRunner.emitExit(8, null)

  await expect(startPromise).rejects.toMatchObject({
    code: 'UPSTREAM_NOT_FOUND',
    message: 'RTSP upstream returned 404 Not Found',
  })

  const recentError = source.snapshotStatus().recentError
  expect(recentError).toBeTruthy()
  expect(recentError).toMatchObject({
    code: 'UPSTREAM_NOT_FOUND',
    message: 'RTSP upstream returned 404 Not Found',
  })
  const detail = recentError?.detail as { reason?: string; stderrTail?: string[] } | undefined
  expect(detail?.reason).toBe('not_found')
  expect(detail?.stderrTail?.[0]).toContain('rtsp://admin:***@camera.local/live')
})
