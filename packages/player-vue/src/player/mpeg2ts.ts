import MpegTs from 'mpegts.js'
import type { MediaPlayer, MediaPlayerConfig, MediaPlayerSource, MediaInfo } from '../types.js'

export function createPlayer(mediaDataSource: MediaPlayerSource, config: MediaPlayerConfig = {}): MediaPlayer {
  if (!MpegTs.isSupported()) {
    throw new Error('MPEG2-TS is not supported in this browser')
  }

  const player = MpegTs.createPlayer(mediaDataSource, config)

  const instance: MediaPlayer = {
    onError: undefined,
    onMediaInfo: undefined,
    onMetadataArrived: undefined,
    attachMediaElement,
    detachMediaElement,
    load,
    unload,
    play,
    pause,
    destroy,
  }

  player.on(MpegTs.Events.ERROR, handlePlayerError)
  player.on(MpegTs.Events.MEDIA_INFO, handleMediaInfo)
  player.on(MpegTs.Events.METADATA_ARRIVED, handleMetadataArrived)

  function handlePlayerError(type: string, detail: string, info: unknown) {
    instance.onError?.({ type, detail, info })
  }

  function handleMediaInfo(mediaInfo: MediaInfo) {
    instance.onMediaInfo?.(mediaInfo)
  }

  function handleMetadataArrived(metadata: unknown) {
    instance.onMetadataArrived?.(metadata)
  }

  function attachMediaElement(nextMediaElement: HTMLVideoElement) {
    player.attachMediaElement(nextMediaElement)
  }

  function detachMediaElement() {
    player.detachMediaElement()
  }

  function load() {
    player.load()
  }

  function unload() {
    player.unload()
  }

  async function play() {
    await player.play()
  }

  function pause() {
    player.pause()
  }

  function destroy() {
    player.off(MpegTs.Events.ERROR, handlePlayerError)
    player.off(MpegTs.Events.MEDIA_INFO, handleMediaInfo)
    player.off(MpegTs.Events.METADATA_ARRIVED, handleMetadataArrived)
    player.pause()
    player.unload()
    player.detachMediaElement()
    player.destroy()
  }

  return instance
}
