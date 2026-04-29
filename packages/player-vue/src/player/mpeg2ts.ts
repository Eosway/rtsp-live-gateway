import MpegTs from 'mpegts.js'
import type { MpegTsPlayer } from '../types.js'

export function createPlayer(): MpegTsPlayer {
  let player: ReturnType<typeof MpegTs.createPlayer> | undefined

  async function attach(videoEl: HTMLVideoElement, url: string, stashBuffer: boolean) {
    if (!MpegTs.isSupported()) {
      throw new Error('mpegts.js is not supported in this browser')
    }
    destroy()

    player = MpegTs.createPlayer(
      { type: 'flv', isLive: true, url, hasAudio: false, hasVideo: true },
      {
        enableStashBuffer: stashBuffer,
        liveBufferLatencyChasing: true,
      }
    )

    player.attachMediaElement(videoEl)
    player.load()
  }

  async function play() {
    if (!player) {
      return
    }
    await player.play()
  }

  function destroy() {
    if (!player) {
      return
    }
    player.pause()
    player.unload()
    player.detachMediaElement()
    player.destroy()
    player = undefined
  }

  return {
    attach,
    play,
    destroy,
  }
}
