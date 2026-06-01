import { afterEach, describe, expect, test, vi } from 'vitest'
import type { MediaPlayer } from '../types.js'
import { useRtspFlvPlayer } from '../composables/useRtspFlvPlayer.js'
import { createPlayer } from '../player/mpeg2ts.js'
import { createStream, deleteStream } from '@eosway/rtsp-live-gateway-client'

vi.mock('../player/mpeg2ts.js', () => ({
  createPlayer: vi.fn(),
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
    onMetadataArrived: undefined,
    attachMediaElement: vi.fn(),
    detachMediaElement: vi.fn(),
    load: vi.fn(),
    unload: vi.fn(),
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    destroy: vi.fn(),
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useRtspFlvPlayer', () => {
  test('should derive hasAudio from sourceConfig.audio.enabled', async () => {
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

    controller.attach({} as HTMLVideoElement)
    await controller.start()

    expect(controller.status.value).toBe('running')
    expect(createPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'flv',
        isLive: true,
        url: 'http://localhost:3000/v1/live/st_audio',
        hasAudio: true,
        hasVideo: true,
      }),
      expect.any(Object)
    )
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

    controller.attach({} as HTMLVideoElement)
    await controller.start()

    expect(controller.status.value).toBe('running')
    expect(createPlayer).toHaveBeenCalledWith(expect.objectContaining({ hasAudio: false }), expect.any(Object))

    await controller.stop('manual')

    expect(controller.status.value).toBe('idle')
    expect(deleteStream).toHaveBeenCalledWith('http://localhost:3000', 'st_video_only')
  })
})
