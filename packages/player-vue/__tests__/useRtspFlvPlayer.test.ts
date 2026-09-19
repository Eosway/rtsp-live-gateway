import { afterEach, describe, expect, test, vi } from 'vitest'
import type { PlayerHandle } from '../src/types.js'
import { useRtspFlvPlayer } from '../src/composables/useRtspFlvPlayer.js'
import { createPlayer } from '../src/player/index.js'
import { createStream } from '@eosway/rtsp-live-gateway-client'

vi.mock('../src/player/index.js', () => ({
  createPlayer: vi.fn(),
  isSupported: vi.fn(() => true),
}))
vi.mock('@eosway/rtsp-live-gateway-client', () => ({
  ClientError: class ClientError extends Error {},
  buildLiveUrl: vi.fn((base: string, id: string) => `${base}/v1/live/${id}`),
  createStream: vi.fn(),
}))

function fakePlayer(): PlayerHandle {
  const listeners = new Map<string, Set<(payload: never) => void>>()
  const on = (type: string, listener: (payload: never) => void) => {
    const set = listeners.get(type) ?? new Set()
    set.add(listener)
    listeners.set(type, set)
  }
  return {
    attach: vi.fn(async () => undefined),
    start: vi.fn(async () => {
      for (const listener of listeners.get('started') ?? []) listener(undefined as never)
    }),
    stop: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined),
    on,
    off: vi.fn(),
  }
}

afterEach(() => vi.clearAllMocks())

describe('useRtspFlvPlayer', () => {
  test('starts rivmux and exposes lifecycle state', async () => {
    const player = fakePlayer()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({ streamId: 'st_test', state: 'idle', reused: false, createdAt: '2026-09-19T00:00:00.000Z' })
    const onStarted = vi.fn()
    const controller = useRtspFlvPlayer({ serverUrl: 'http://localhost:3000', sourceConfig: { url: 'rtsp://camera/live' } }, { onStarted })
    controller.attach({} as HTMLVideoElement)

    await controller.start()

    expect(controller.status.value).toBe('started')
    expect(onStarted).toHaveBeenCalledOnce()
    expect(createPlayer).toHaveBeenCalledWith('http://localhost:3000/v1/live/st_test', undefined)
  })

  test('stop keeps the stream and destroy marks the controller destroyed', async () => {
    const player = fakePlayer()
    vi.mocked(createPlayer).mockReturnValue(player)
    vi.mocked(createStream).mockResolvedValue({ streamId: 'st_test', state: 'idle', reused: true, createdAt: '2026-09-19T00:00:00.000Z' })
    const controller = useRtspFlvPlayer({ serverUrl: 'http://localhost:3000', sourceConfig: { url: 'rtsp://camera/live' } })
    controller.attach({} as HTMLVideoElement)
    await controller.start()
    await controller.stop()
    expect(player.stop).toHaveBeenCalledOnce()
    await controller.destroy()
    expect(controller.status.value).toBe('destroyed')
  })
})
