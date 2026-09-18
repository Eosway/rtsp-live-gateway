import { afterEach, describe, expect, test, vi } from 'vitest'
import type { MediaInfo, PlayerError, PlayerEventType } from 'rivmux'
import { RivmuxPlayer } from 'rivmux'
import { createRivmuxPlayer } from '../player/rivmux.js'

type Listener = (payload: never) => void

const listeners = new Map<PlayerEventType, Set<Listener>>()
const attach = vi.fn(async () => undefined)
const start = vi.fn(async () => undefined)
const destroy = vi.fn(async () => undefined)
const on = vi.fn((type: PlayerEventType, listener: Listener) => {
  const bucket = listeners.get(type) ?? new Set<Listener>()
  bucket.add(listener)
  listeners.set(type, bucket)
})
const off = vi.fn((type: PlayerEventType, listener: Listener) => {
  listeners.get(type)?.delete(listener)
})

vi.mock('rivmux', () => ({
  RivmuxPlayer: vi.fn(function MockRivmuxPlayer() {
    return { attach, start, destroy, on, off }
  }),
}))

function emit(type: PlayerEventType, payload: unknown) {
  for (const listener of listeners.get(type) ?? []) {
    listener(payload as never)
  }
}

afterEach(() => {
  listeners.clear()
  vi.clearAllMocks()
})

describe('createRivmuxPlayer', () => {
  test('delegates the asynchronous lifecycle', async () => {
    const config = { playback: { autoPlay: false } }
    const player = createRivmuxPlayer('http://localhost/live.flv', config)
    const video = {} as HTMLVideoElement

    expect(RivmuxPlayer).toHaveBeenCalledWith('http://localhost/live.flv', config)

    await player.attach(video)
    await player.start()
    await player.destroy()

    expect(attach).toHaveBeenCalledWith(video)
    expect(start).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
    expect(off).toHaveBeenCalledTimes(2)
  })

  test('normalizes rivmux error and media-info events', () => {
    const player = createRivmuxPlayer('http://localhost/live.flv')
    const onError = vi.fn()
    const onMediaInfo = vi.fn()
    player.onError = onError
    player.onMediaInfo = onMediaInfo

    const error: PlayerError = {
      kind: 'network',
      code: 'RIVMUX_HTTP_STATUS',
      message: 'HTTP request failed.',
      terminal: true,
    }
    const mediaInfo: MediaInfo = { container: 'flv', videoCodec: 'avc1.64001f' }

    emit('error', error)
    emit('mediaInfo', mediaInfo)

    expect(onError).toHaveBeenCalledWith({
      code: error.code,
      message: error.message,
      detail: error,
      terminal: true,
    })
    expect(onMediaInfo).toHaveBeenCalledWith(mediaInfo)
  })
})
