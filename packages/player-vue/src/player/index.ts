import { getCapabilities, isSupported, RivmuxPlayer } from 'rivmux'
import type { RivmuxPlayerOptions } from 'rivmux'
import type { PlayerHandle } from '../types.js'

export { getCapabilities, isSupported }

export function createPlayer(url: string, options?: RivmuxPlayerOptions): PlayerHandle {
  return createRivmuxPlayer(url, options)
}

export function createRivmuxPlayer(url: string, config: RivmuxPlayerOptions = {}): PlayerHandle {
  const player = new RivmuxPlayer(url, config)

  return {
    attach: (video) => player.attach(video),
    start: () => player.start(),
    stop: () => player.stop(),
    destroy: () => player.destroy(),
    on(type, listener) {
      player.on(type, listener as never)
    },
    off(type, listener) {
      player.off(type, listener as never)
    },
  }
}
