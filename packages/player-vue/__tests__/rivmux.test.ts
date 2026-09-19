import { afterEach, describe, expect, test, vi } from 'vitest'
import { createRivmuxPlayer } from '../src/player/index.js'

const listeners = new Map<string, Set<(payload: never) => void>>()
const attach = vi.fn(async () => undefined)
const start = vi.fn(async () => undefined)
const stop = vi.fn(async () => undefined)
const destroy = vi.fn(async () => undefined)

vi.mock('rivmux', () => ({
  RivmuxPlayer: vi.fn(function MockPlayer() {
    return {
      attach,
      start,
      stop,
      destroy,
      on: (type: string, listener: (payload: never) => void) => {
        const set = listeners.get(type) ?? new Set()
        set.add(listener)
        listeners.set(type, set)
      },
      off: (type: string, listener: (payload: never) => void) => listeners.get(type)?.delete(listener),
    }
  }),
}))

afterEach(() => {
  listeners.clear()
  vi.clearAllMocks()
})

describe('createRivmuxPlayer', () => {
  test('delegates lifecycle', async () => {
    const player = createRivmuxPlayer('http://localhost/live.flv')
    const video = {} as HTMLVideoElement

    await player.attach(video)
    await player.start()
    await player.stop()
    await player.destroy()

    expect(attach).toHaveBeenCalledWith(video)
    expect(start).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
  })
})
