import { RivmuxPlayer } from 'rivmux'
import type { MediaInfo, PlayerError, RivmuxPlayerOptions } from 'rivmux'
import type { MediaPlayer } from '../types.js'

export function createRivmuxPlayer(url: string, config: RivmuxPlayerOptions = {}): MediaPlayer {
  const player = new RivmuxPlayer(url, config)

  const instance: MediaPlayer = {
    onError: undefined,
    onMediaInfo: undefined,
    attach,
    start,
    destroy,
  }

  player.on('error', handlePlayerError)
  player.on('mediaInfo', handleMediaInfo)

  function handlePlayerError(error: PlayerError) {
    instance.onError?.({
      code: error.code,
      message: error.message,
      detail: error,
      terminal: error.terminal,
    })
  }

  function handleMediaInfo(mediaInfo: MediaInfo) {
    instance.onMediaInfo?.(mediaInfo)
  }

  async function attach(mediaElement: HTMLVideoElement) {
    await player.attach(mediaElement)
  }

  async function start() {
    await player.start()
  }

  async function destroy() {
    try {
      await player.destroy()
    } finally {
      player.off('error', handlePlayerError)
      player.off('mediaInfo', handleMediaInfo)
    }
  }

  return instance
}
