import { ClientError, buildLiveUrl, createStream, deleteStream } from '@rtsp-gateway/client'
import type { StreamCreateRequest } from '@rtsp-gateway/client'
import { ref, shallowRef } from 'vue'
import { createPlayer } from '../player/mpeg2ts.js'
import type {
  MediaPlayer,
  MediaPlayerError,
  RtspFlvPlayerError,
  RtspFlvPlayerStatus,
  UseRtspFlvPlayerCallbacks,
  UseRtspFlvPlayerOptions,
  UseRtspFlvPlayerReturn,
} from '../types.js'

type UseRtspFlvPlayerOptionsSource = UseRtspFlvPlayerOptions | (() => UseRtspFlvPlayerOptions)

async function createManagedStream(baseUrl: string, sourceConfig: StreamCreateRequest): Promise<string> {
  const response = await createStream(baseUrl, sourceConfig)
  return response.streamId
}

async function deleteManagedStream(baseUrl: string, streamId: string): Promise<void> {
  try {
    await deleteStream(baseUrl, streamId)
  } catch (error) {
    // 显式停止时删除失败也不抛出，避免中断组件控制流。
    void error
  }
}

export function useRtspFlvPlayer(optionsSource: UseRtspFlvPlayerOptionsSource, callbacks: UseRtspFlvPlayerCallbacks = {}): UseRtspFlvPlayerReturn {
  const videoRef = shallowRef<HTMLVideoElement>()
  const streamId = ref<string>()
  const state = ref<RtspFlvPlayerStatus>('idle')
  const error = ref<RtspFlvPlayerError>()
  let player: MediaPlayer | undefined

  function resolveOptions(): UseRtspFlvPlayerOptions {
    return typeof optionsSource === 'function' ? optionsSource() : optionsSource
  }

  function emitStateChange(nextState: RtspFlvPlayerStatus) {
    state.value = nextState
    callbacks.onStateChange?.(nextState)
  }

  function attach(videoEl: HTMLVideoElement) {
    videoRef.value = videoEl
    player?.attachMediaElement(videoEl)
  }

  async function destroyPlayback(reason: string): Promise<void> {
    player?.destroy()
    player = undefined
    emitStateChange('idle')
    callbacks.onClosed?.(reason)
  }

  function toRtspFlvPlayerError(mediaPlayerError: MediaPlayerError): RtspFlvPlayerError {
    return {
      type: 'media_player',
      code: mediaPlayerError.type,
      message: mediaPlayerError.detail,
      detail: mediaPlayerError.info,
      cause: mediaPlayerError,
    }
  }

  async function start(): Promise<void> {
    const options = resolveOptions()
    if (state.value === 'starting' || state.value === 'running') {
      return
    }

    emitStateChange('starting')
    error.value = undefined
    try {
      if (!videoRef.value) {
        throw new Error('Video element is not attached')
      }
      if (!streamId.value) {
        streamId.value = await createManagedStream(options.baseUrl, options.sourceConfig)
        callbacks.onCreated?.(streamId.value)
      }

      const liveUrl = buildLiveUrl(options.baseUrl, streamId.value)
      player?.destroy()
      player = createPlayer(
        { type: 'flv', isLive: true, url: liveUrl, hasAudio: false, hasVideo: true },
        {
          enableStashBuffer: Boolean(options.stashBuffer),
          liveBufferLatencyChasing: true,
        }
      )
      player.onError = (mediaPlayerError) => {
        const normalizedError = toRtspFlvPlayerError(mediaPlayerError)
        error.value = normalizedError
        emitStateChange('error')
        callbacks.onError?.(normalizedError)
      }
      player.onMediaInfo = (mediaInfo) => {
        callbacks.onMediaInfo?.(mediaInfo)
      }
      player.onMetadataArrived = (metadata) => {
        callbacks.onMetadataArrived?.(metadata)
      }
      player.attachMediaElement(videoRef.value)
      player.load()
      if (options.autoPlay ?? true) {
        await player.play()
      }
      emitStateChange('running')
    } catch (caughtError) {
      emitStateChange('error')
      const clientError = caughtError instanceof ClientError ? caughtError : undefined
      error.value = {
        type: 'client',
        code: clientError?.code ?? 'PLAYER_START_FAILED',
        message: caughtError instanceof Error ? caughtError.message : String(caughtError),
        detail: {
          status: clientError?.status,
          detail: clientError?.detail,
        },
        cause: caughtError,
      }
      callbacks.onError?.(error.value)
    }
  }

  async function stop(reason = 'manual'): Promise<void> {
    const options = resolveOptions()
    const currentStreamId = streamId.value
    await destroyPlayback(reason)
    streamId.value = undefined
    if (currentStreamId) {
      await deleteManagedStream(options.baseUrl, currentStreamId)
    }
  }

  async function reload(reason = 'reload'): Promise<void> {
    const options = resolveOptions()
    const currentStreamId = streamId.value
    await destroyPlayback(reason)
    streamId.value = undefined
    if (currentStreamId) {
      await deleteManagedStream(options.baseUrl, currentStreamId)
    }
    await start()
  }

  async function detach(reason = 'detach'): Promise<void> {
    const options = resolveOptions()
    const currentStreamId = streamId.value
    await destroyPlayback(reason)
    videoRef.value = undefined
    if (options.cleanOnUnmount && currentStreamId) {
      streamId.value = undefined
      await deleteManagedStream(options.baseUrl, currentStreamId)
    }
  }

  return {
    videoRef,
    streamId,
    state,
    error,
    attach,
    detach,
    start,
    stop,
    reload,
  }
}
