import assert from 'node:assert/strict'
import test from 'node:test'
import { PlaybackSession } from './PlaybackSession.js'
import { StreamSource } from './StreamSource.js'
import type { Logger } from '../lib/logger.js'
import type { NormalizedStreamCreateRequest } from '../types.js'

class FakeRunner {
  private stdoutListeners: Array<(chunk: Uint8Array) => void> = []
  private stderrListeners: Array<(line: string) => void> = []
  private exitListeners: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = []
  private errorListeners: Array<(error: Error) => void> = []
  private stopped = false

  start(): void {}

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

function createRequest(): NormalizedStreamCreateRequest {
  return {
    url: 'rtsp://example.com/live',
    transport: 'tcp',
    ioTimeoutUs: 5_000_000,
    video: {
      mode: 'copy',
      codec: 'libx264',
    },
    audio: {
      enabled: false,
      mode: 'drop',
      codec: 'aac',
      bitrateKbps: 0,
    },
    allowPrivateIp: false,
    labels: {},
  }
}

function createSource(fakeRunners: FakeRunner[]): StreamSource {
  return new StreamSource({
    streamId: 'st_test',
    sourceKey: 'src_test',
    req: createRequest(),
    ffmpegPath: '/usr/bin/ffmpeg',
    startupTimeoutMs: 1000,
    idleGraceMs: 1000,
    stopGraceMs: 100,
    maxStartAttempts: 1,
    logger: createLogger(),
    runnerFactory: () => {
      const nextRunner = fakeRunners.shift()
      assert.ok(nextRunner, 'expected fake runner')
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

test('running source should bootstrap late viewer at next tag boundary', async () => {
  const fakeRunner = new FakeRunner()
  const source = createSource([fakeRunner])
  const firstViewer = createSession('se_first')
  source.addViewer(firstViewer)

  const startPromise = source.ensureStarted('first_viewer')
  fakeRunner.emitStdout(createFlvHeader())
  fakeRunner.emitStdout(createVideoSequenceHeaderTag())
  await startPromise

  const firstDrainPromise = drainSession(firstViewer, 2)
  const firstChunks = await firstDrainPromise
  assert.deepEqual(firstChunks, [createFlvHeader(), createVideoSequenceHeaderTag()])

  const lateViewer = createSession('se_late')
  source.addViewer(lateViewer)
  const lateDrainPromise = drainSession(lateViewer, 3)

  fakeRunner.emitStdout(createVideoInterFrameTag())

  const lateChunks = await lateDrainPromise
  assert.deepEqual(lateChunks, [createFlvHeader(), createVideoSequenceHeaderTag(), createVideoInterFrameTag()])
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
  firstRunner.emitStdout(firstHeader)
  firstRunner.emitStdout(firstSequence)
  await firstStartPromise
  await source.stop('idle_timeout')

  const secondViewer = createSession('se_restart_second')
  source.addViewer(secondViewer)
  const secondStartPromise = source.ensureStarted('first_viewer')
  const secondHeader = createFlvHeader()
  const secondSequence = createFlvTag(9, [0x17, 0x00, 0x00, 0x00, 0x00, 0x09])
  secondRunner.emitStdout(secondHeader)
  secondRunner.emitStdout(secondSequence)
  await secondStartPromise

  const secondDrainPromise = drainSession(secondViewer, 2)
  const secondChunks = await secondDrainPromise
  assert.deepEqual(secondChunks, [secondHeader, secondSequence])
})
