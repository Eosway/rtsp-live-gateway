import { afterEach, describe, expect, test, vi } from 'vitest'
import { createPlayer, isPlayerSupported } from '../player/index.js'
import { createRivmuxPlayer } from '../player/rivmux.js'

vi.mock('rivmux', async () => {
  const actual = await vi.importActual<typeof import('rivmux')>('rivmux')
  return {
    ...actual,
    isSupported: vi.fn(() => true),
  }
})

vi.mock('../player/rivmux.js', () => ({
  createRivmuxPlayer: vi.fn(() => ({ engine: 'rivmux' })),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('createPlayer', () => {
  test('reports rivmux support', () => {
    expect(isPlayerSupported()).toBe(true)
  })

  test('creates rivmux with playback overrides', () => {
    createPlayer('http://localhost/live.flv', false, true, {
      playback: { muted: true },
      latency: { startupBuffer: 0.5, target: 1, max: 3 },
    })

    expect(createRivmuxPlayer).toHaveBeenCalledWith('http://localhost/live.flv', {
      playback: { muted: true, autoPlay: false },
      latency: { startupBuffer: 0.5, target: 1, max: 3 },
    })
  })
})
