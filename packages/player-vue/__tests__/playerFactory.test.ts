import { afterEach, expect, test, vi } from 'vitest'
import { createPlayer } from '../src/player/index.js'

const { RivmuxPlayer } = vi.hoisted(() => ({
  RivmuxPlayer: vi.fn(function MockPlayer() {
    return { attach: vi.fn(), start: vi.fn(), stop: vi.fn(), destroy: vi.fn(), on: vi.fn(), off: vi.fn() }
  }),
}))
vi.mock('rivmux', () => ({ isSupported: vi.fn(() => true), RivmuxPlayer }))

afterEach(() => vi.clearAllMocks())

test('passes rivmux options without legacy overrides', () => {
  const options = { playback: { autoPlay: false, muted: true } }
  createPlayer('http://localhost/live.flv', options)
  expect(RivmuxPlayer).toHaveBeenCalledWith('http://localhost/live.flv', options)
})
