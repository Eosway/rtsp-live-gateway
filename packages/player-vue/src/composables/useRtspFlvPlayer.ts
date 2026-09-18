import { ClientError, buildLiveUrl, createStream, deleteStream } from '@eosway/rtsp-live-gateway-client'
import type { StreamCreateRequest } from '@eosway/rtsp-live-gateway-client'
import { ref, shallowRef } from 'vue'
import { createPlayer, isPlayerSupported } from '../player/index.js'
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

const STARTUP_ERROR_GRACE_MS = 2000
const PLAYBACK_READY_EVENTS = ['loadedmetadata', 'canplay', 'playing'] as const

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
  const status = ref<RtspFlvPlayerStatus>('idle')
  const error = ref<RtspFlvPlayerError>()
  let player: MediaPlayer | undefined
  let operationChain: Promise<void> = Promise.resolve()
  let operationToken = 0
  let startupGraceTimer: ReturnType<typeof setTimeout> | undefined
  let startupPendingError: RtspFlvPlayerError | undefined
  let startupPlaybackConfirmed = false
  let removePlaybackReadyListeners: (() => void) | undefined

  function resolveOptions(): UseRtspFlvPlayerOptions {
    return typeof optionsSource === 'function' ? optionsSource() : optionsSource
  }

  function setStatus(nextStatus: RtspFlvPlayerStatus) {
    status.value = nextStatus
  }

  function attach(videoEl: HTMLVideoElement) {
    videoRef.value = videoEl
  }

  function nextOperationToken(): number {
    operationToken += 1
    return operationToken
  }

  function isOperationCurrent(token: number): boolean {
    return token === operationToken
  }

  function runExclusive(task: () => Promise<void>): Promise<void> {
    const run = operationChain.catch(() => undefined).then(task)
    operationChain = run.catch(() => undefined)
    return run
  }

  function clearStartupGraceTimer() {
    if (startupGraceTimer) {
      clearTimeout(startupGraceTimer)
      startupGraceTimer = undefined
    }
  }

  function clearPlaybackReadyListeners() {
    removePlaybackReadyListeners?.()
    removePlaybackReadyListeners = undefined
  }

  function resetStartupGuard() {
    clearStartupGraceTimer()
    clearPlaybackReadyListeners()
    startupPendingError = undefined
    startupPlaybackConfirmed = false
  }

  function emitFinalError(nextError: RtspFlvPlayerError) {
    resetStartupGuard()
    error.value = nextError
    setStatus('error')
    callbacks.onError?.(nextError)
  }

  function finalizeStartupReady(token: number, currentPlayer: MediaPlayer) {
    if (!isOperationCurrent(token) || player !== currentPlayer || startupPlaybackConfirmed) {
      return
    }
    startupPlaybackConfirmed = true
    startupPendingError = undefined
    clearStartupGraceTimer()
    clearPlaybackReadyListeners()
    callbacks.onReady?.()
  }

  function scheduleStartupGraceWindow(token: number) {
    if (startupGraceTimer) {
      return
    }
    startupGraceTimer = setTimeout(() => {
      startupGraceTimer = undefined
      if (!isOperationCurrent(token) || startupPlaybackConfirmed || !startupPendingError) {
        return
      }
      emitFinalError(startupPendingError)
    }, STARTUP_ERROR_GRACE_MS)
  }

  function bindPlaybackReadySignals(videoEl: HTMLVideoElement, token: number, currentPlayer: MediaPlayer) {
    clearPlaybackReadyListeners()
    const handlePlaybackReady = () => {
      finalizeStartupReady(token, currentPlayer)
    }
    for (const eventName of PLAYBACK_READY_EVENTS) {
      videoEl.addEventListener(eventName, handlePlaybackReady)
    }
    removePlaybackReadyListeners = () => {
      for (const eventName of PLAYBACK_READY_EVENTS) {
        videoEl.removeEventListener(eventName, handlePlaybackReady)
      }
    }
  }

  async function destroyPlayback(reason: string): Promise<void> {
    resetStartupGuard()
    const currentPlayer = player
    player = undefined
    await currentPlayer?.destroy()
    player = undefined
    setStatus('idle')
    callbacks.onClosed?.(reason)
  }

  function toRtspFlvPlayerError(mediaPlayerError: MediaPlayerError): RtspFlvPlayerError {
    return {
      type: 'media_player',
      code: mediaPlayerError.code,
      message: mediaPlayerError.message,
      detail: mediaPlayerError.detail,
      cause: mediaPlayerError,
    }
  }

  async function startInternal(): Promise<void> {
    if (status.value === 'starting' || status.value === 'running') {
      return
    }

    const token = nextOperationToken()
    const options = resolveOptions()
    setStatus('starting')
    error.value = undefined
    resetStartupGuard()
    let currentPlayer: MediaPlayer | undefined
    try {
      if (!videoRef.value) {
        throw new Error('Video element is not attached')
      }
      if (!isPlayerSupported()) {
        throw new Error('Rivmux is not supported in this browser')
      }
      if (!streamId.value) {
        const nextStreamId = await createManagedStream(options.baseUrl, options.sourceConfig)
        if (!isOperationCurrent(token)) {
          await deleteManagedStream(options.baseUrl, nextStreamId)
          return
        }
        streamId.value = nextStreamId
        callbacks.onCreated?.(nextStreamId)
      }

      const liveUrl = buildLiveUrl(options.baseUrl, streamId.value)
      currentPlayer = createPlayer(liveUrl, options.autoPlay ?? true, videoRef.value.muted, options.playerOptions)
      bindPlaybackReadySignals(videoRef.value, token, currentPlayer)

      currentPlayer.onError = (mediaPlayerError) => {
        if (!isOperationCurrent(token) || player !== currentPlayer) {
          return
        }
        const normalizedError = toRtspFlvPlayerError(mediaPlayerError)
        if (!startupPlaybackConfirmed && mediaPlayerError.terminal !== true) {
          startupPendingError = normalizedError
          scheduleStartupGraceWindow(token)
          return
        }
        emitFinalError(normalizedError)
      }
      currentPlayer.onMediaInfo = (mediaInfo) => {
        if (!isOperationCurrent(token) || player !== currentPlayer) {
          return
        }
        callbacks.onMediaInfo?.(mediaInfo)
      }
      const previousPlayer = player
      player = undefined
      await previousPlayer?.destroy()
      player = currentPlayer
      await currentPlayer.attach(videoRef.value)
      await currentPlayer.start()
      if (!isOperationCurrent(token) || player !== currentPlayer) {
        await currentPlayer.destroy()
        return
      }
      if (status.value === 'error') {
        return
      }
      setStatus('running')
    } catch (caughtError) {
      if (currentPlayer && player === currentPlayer) {
        player = undefined
      }
      await currentPlayer?.destroy()
      if (!isOperationCurrent(token)) {
        return
      }
      resetStartupGuard()
      if (status.value === 'error') {
        return
      }
      const clientError = caughtError instanceof ClientError ? caughtError : undefined
      const nextError: RtspFlvPlayerError = clientError
        ? {
            type: 'client',
            code: clientError.code ?? 'STREAM_CREATE_FAILED',
            message: clientError.message,
            requestId: clientError.requestId,
            detail: {
              status: clientError.status,
              detail: clientError.detail,
            },
            cause: caughtError,
          }
        : {
            type: 'media_player',
            code: caughtError instanceof Error && caughtError.name !== 'Error' ? caughtError.name : 'PLAYER_START_FAILED',
            message: caughtError instanceof Error ? caughtError.message : String(caughtError),
            cause: caughtError,
          }
      error.value = nextError
      setStatus('error')
      callbacks.onError?.(nextError)
    }
  }

  async function start(): Promise<void> {
    return runExclusive(startInternal)
  }

  async function stop(reason = 'manual'): Promise<void> {
    return runExclusive(async () => {
      nextOperationToken()
      const options = resolveOptions()
      const currentStreamId = streamId.value
      await destroyPlayback(reason)
      streamId.value = undefined
      if (currentStreamId) {
        await deleteManagedStream(options.baseUrl, currentStreamId)
      }
    })
  }

  async function reload(reason = 'reload'): Promise<void> {
    return runExclusive(async () => {
      nextOperationToken()
      const options = resolveOptions()
      const currentStreamId = streamId.value
      await destroyPlayback(reason)
      streamId.value = undefined
      if (currentStreamId) {
        await deleteManagedStream(options.baseUrl, currentStreamId)
      }
      await startInternal()
    })
  }

  async function detach(reason = 'detach'): Promise<void> {
    return runExclusive(async () => {
      nextOperationToken()
      const options = resolveOptions()
      const currentStreamId = streamId.value
      await destroyPlayback(reason)
      videoRef.value = undefined
      if (options.cleanOnUnmount && currentStreamId) {
        streamId.value = undefined
        await deleteManagedStream(options.baseUrl, currentStreamId)
      }
    })
  }

  return {
    videoRef,
    streamId,
    status,
    error,
    attach,
    detach,
    start,
    stop,
    reload,
  }
}
