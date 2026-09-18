import { isSupported } from 'rivmux'
import type { RivmuxPlayerOptions } from 'rivmux'
import type { MediaPlayer } from '../types.js'
import { createRivmuxPlayer } from './rivmux.js'

export function isPlayerSupported(): boolean {
  return isSupported()
}

export function createPlayer(url: string, autoPlay: boolean, muted: boolean, options?: RivmuxPlayerOptions): MediaPlayer {
  if (!isPlayerSupported()) {
    throw new Error('Rivmux is not supported in this browser')
  }

  return createRivmuxPlayer(url, {
    ...options,
    playback: {
      ...options?.playback,
      autoPlay,
      muted: options?.playback?.muted ?? muted,
    },
  })
}
