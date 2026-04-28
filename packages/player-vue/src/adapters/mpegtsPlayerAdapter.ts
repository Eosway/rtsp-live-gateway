import mpegtsModule from 'mpegts.js'
import type { MpegtsPlayer } from '../types.js'

export function createMpegtsPlayer(): MpegtsPlayer {
  const mpegts = mpegtsModule
  let player: ReturnType<typeof mpegtsModule.createPlayer> | undefined

  async function attach(videoEl: HTMLVideoElement, url: string, stashBuffer: boolean) {
    if (!mpegts.isSupported()) {
      throw new Error('mpegts.js is not supported in this browser')
    }
    destroy()

    player = mpegts.createPlayer(
      {
        type: 'flv',
        isLive: true,
        url,
        hasAudio: false,
        hasVideo: true,
      },
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
