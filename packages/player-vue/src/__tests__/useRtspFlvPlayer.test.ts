import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { MediaPlayer } from '../types.js'
import { useRtspFlvPlayer } from '../composables/useRtspFlvPlayer.js'
import { createPlayer } from '../player/index.js'
import { createStream, deleteStream } from '@eosway/rtsp-live-gateway-client'

vi.mock('../player/index.js', () => ({
  createPlayer: vi.fn(),
  isPlayerSupported: vi.fn(() => true),
}))

vi.mock('@eosway/rtsp-live-gateway-client', () => {
  class MockClientError extends Error {
    readonly status: number
    readonly code?: string
    readonly requestId?: string
    readonly detail?: unknown

    constructor(message: string, options: { status: number; code?: string; requestId?: string; detail?: unknown }) {
      super(message)
      this.status = options.status
      this.code = options.code
      this.requestId = options.requestId
      this.detail = options.detail
    }
  }

  return {
    ClientError: MockClientError,
    buildLiveUrl: vi.fn((baseUrl: string, streamId: string) => `${baseUrl}/v1/live/${streamId}`),
    createStream: vi.fn(),
    deleteStream: vi.fn(),
  }
})

function createFakePlayer(): MediaPlayer {
  return {
    onError: undefined,
    onMediaInfo: undefined,
    attach: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined),
  }
}

function createFakeVideoElement(): HTMLVideoElement {
  const listeners = new Map<string, Set<EventListener>>()
  return {
    muted: false,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      let bucket = listeners.get(type)
      if (!bucket) {
        bucket = new Set<EventListener>()
        listeners.set(type, bucket)
      }
      bucket.add(listener)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    }),
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event)
      }
      return true
    },
  } as unknown as HTMLVideoElement
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useRtspFlvPlayer', () => {
  test('should pass rivmux options to the player factory', async () => {
    const player = createFakePlayer()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_rivmux',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const playerOptions = { latency: { target: 1, max: 2 } }
    const controller = useRtspFlvPlayer({
      baseUrl: 'http://localhost:3000',
      sourceConfig: { url: 'rtsp://camera/live' },
      playerOptions,
    })

    controller.attach(createFakeVideoElement())
    await controller.start()

    expect(createPlayer).toHaveBeenCalledWith('http://localhost:3000/v1/live/st_rivmux', true, false, playerOptions)
  })

  test('should surface terminal player errors immediately during startup', async () => {
    const player = createFakePlayer()
    const onError = vi.fn()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_terminal_error',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const controller = useRtspFlvPlayer(
      {
        baseUrl: 'http://localhost:3000',
        sourceConfig: { url: 'rtsp://camera/live' },
      },
      { onError }
    )

    controller.attach(createFakeVideoElement())
    await controller.start()
    player.onError?.({
      code: 'RIVMUX_HTTP_STATUS',
      message: 'HTTP request failed.',
      terminal: true,
    })

    expect(controller.status.value).toBe('error')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'RIVMUX_HTTP_STATUS' }))
  })

  test('should start an audio-enabled source with rivmux', async () => {
    const player = createFakePlayer()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_audio',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const controller = useRtspFlvPlayer({
      baseUrl: 'http://localhost:3000',
      sourceConfig: {
        url: 'rtsp://camera/live',
        audio: {
          enabled: true,
          mode: 'auto',
          codec: 'aac',
        },
      },
      autoPlay: false,
    })

    const videoEl = createFakeVideoElement()
    controller.attach(videoEl)
    await controller.start()

    expect(controller.status.value).toBe('running')
    expect(createPlayer).toHaveBeenCalledWith('http://localhost:3000/v1/live/st_audio', false, false, undefined)
  })

  test('should expose status and reset to idle after stop', async () => {
    const player = createFakePlayer()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_video_only',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(deleteStream).mockResolvedValue(undefined)

    const controller = useRtspFlvPlayer({
      baseUrl: 'http://localhost:3000',
      sourceConfig: {
        url: 'rtsp://camera/live',
        audio: {
          enabled: false,
        },
      },
      autoPlay: false,
    })

    expect(controller.status.value).toBe('idle')

    const videoEl = createFakeVideoElement()
    controller.attach(videoEl)
    await controller.start()

    expect(controller.status.value).toBe('running')
    expect(createPlayer).toHaveBeenCalledWith('http://localhost:3000/v1/live/st_video_only', false, false, undefined)

    await controller.stop('manual')

    expect(controller.status.value).toBe('idle')
    expect(deleteStream).toHaveBeenCalledWith('http://localhost:3000', 'st_video_only')
  })

  test('should defer startup media player error until grace window expires', async () => {
    const player = createFakePlayer()
    const onError = vi.fn()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_startup_error',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const controller = useRtspFlvPlayer(
      {
        baseUrl: 'http://localhost:3000',
        sourceConfig: {
          url: 'rtsp://camera/live',
          audio: {
            enabled: false,
          },
        },
        autoPlay: false,
      },
      {
        onError,
      }
    )

    const videoEl = createFakeVideoElement()
    controller.attach(videoEl)
    await controller.start()

    player.onError?.({
      code: 'MediaError',
      message: 'MediaMSEError',
      detail: { code: 11 },
    })

    expect(controller.status.value).toBe('running')
    expect(onError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1999)
    expect(onError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000)

    expect(controller.status.value).toBe('error')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'media_player',
        code: 'MediaError',
        message: 'MediaMSEError',
      })
    )
  })

  test('should suppress startup media player error after playback becomes ready', async () => {
    const player = createFakePlayer()
    const onError = vi.fn()
    const onReady = vi.fn()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_recover_ready',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const controller = useRtspFlvPlayer(
      {
        baseUrl: 'http://localhost:3000',
        sourceConfig: {
          url: 'rtsp://camera/live',
          audio: {
            enabled: false,
          },
        },
        autoPlay: false,
      },
      {
        onReady,
        onError,
      }
    )

    const videoEl = createFakeVideoElement()
    controller.attach(videoEl)
    await controller.start()

    player.onError?.({
      code: 'MediaError',
      message: 'MediaMSEError',
      detail: { code: 11 },
    })
    expect(controller.status.value).toBe('running')

    videoEl.dispatchEvent(new Event('canplay'))
    expect(controller.status.value).toBe('running')

    expect(controller.error.value).toBeUndefined()
    expect(onReady).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(onError).not.toHaveBeenCalled()
    expect(controller.status.value).toBe('running')
  })

  test('should emit ready only once on first playback-ready signal', async () => {
    const player = createFakePlayer()
    const onReady = vi.fn()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_ready_once',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const controller = useRtspFlvPlayer(
      {
        baseUrl: 'http://localhost:3000',
        sourceConfig: {
          url: 'rtsp://camera/live',
          audio: {
            enabled: false,
          },
        },
        autoPlay: false,
      },
      {
        onReady,
      }
    )

    const videoEl = createFakeVideoElement()
    controller.attach(videoEl)
    await controller.start()

    expect(onReady).not.toHaveBeenCalled()

    videoEl.dispatchEvent(new Event('loadedmetadata'))
    videoEl.dispatchEvent(new Event('canplay'))
    videoEl.dispatchEvent(new Event('playing'))

    expect(onReady).toHaveBeenCalledTimes(1)
    expect(controller.status.value).toBe('running')
  })

  test('should not invalidate active player when start is called again while running', async () => {
    const player = createFakePlayer()
    const onError = vi.fn()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({
      streamId: 'st_repeat_start',
      state: 'idle',
      reused: false,
      createdAt: '2026-06-01T00:00:00.000Z',
    })

    const controller = useRtspFlvPlayer(
      {
        baseUrl: 'http://localhost:3000',
        sourceConfig: {
          url: 'rtsp://camera/live',
          audio: {
            enabled: false,
          },
        },
        autoPlay: false,
      },
      {
        onError,
      }
    )

    const videoEl = createFakeVideoElement()
    controller.attach(videoEl)
    await controller.start()
    videoEl.dispatchEvent(new Event('canplay'))

    await controller.start()

    player.onError?.({
      code: 'NetworkError',
      message: 'HttpStatusCodeInvalid',
      detail: { code: 404 },
    })

    expect(controller.status.value).toBe('error')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'media_player',
        code: 'NetworkError',
      })
    )
    expect(createPlayer).toHaveBeenCalledTimes(1)
  })
})
