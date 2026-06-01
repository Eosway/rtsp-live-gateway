import { ClientError, buildLiveUrl, createStream, deleteStream } from '@eosway/rtsp-live-gateway-client'
import type { StreamCreateRequest } from '@eosway/rtsp-live-gateway-client'
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

const STARTUP_ERROR_GRACE_MS = 2000
const PLAYBACK_READY_EVENTS = ['loadedmetadata', 'canplay', 'playing'] as const

const defaultLivePlayerConfig = {
  enableStashBuffer: true, // 保留输入缓冲，优先抗一般网络抖动而不是追求最低延迟。
  liveSync: true, // 通过温和提升 playbackRate 追赶延迟，避免频繁直接跳帧。
  liveSyncMaxLatency: 4, // 延迟超过 4 秒后开始主动追赶，限制多宫格长期漂移。
  liveSyncTargetLatency: 2, // 将稳态延迟收敛到约 2 秒，兼顾监控实时性与连续性。
  liveSyncPlaybackRate: 1.2, // 追赶时最多 1.2 倍速，降低音视频突兀变化和抖动风险。
  autoCleanupSourceBuffer: true, // 长时播放时主动清理旧缓冲，控制多宫格内存增长。
  autoCleanupMaxBackwardDuration: 30, // 旧缓冲超过 30 秒就触发清理，避免无意义堆积。
  autoCleanupMinBackwardDuration: 15, // 清理后仍保留 15 秒回退缓冲，兼顾短时抖动恢复。
} as const

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

function resolveHasAudio(sourceConfig: StreamCreateRequest): boolean {
  return sourceConfig.audio?.enabled === true
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
    player?.attachMediaElement(videoEl)
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
    currentPlayer?.destroy()
    player = undefined
    setStatus('idle')
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
      currentPlayer = createPlayer(
        { type: 'flv', isLive: true, url: liveUrl, hasAudio: resolveHasAudio(options.sourceConfig), hasVideo: true },
        {
          ...defaultLivePlayerConfig,
          ...options.playerConfig,
        }
      )
      bindPlaybackReadySignals(videoRef.value, token, currentPlayer)

      currentPlayer.onError = (mediaPlayerError) => {
        if (!isOperationCurrent(token) || player !== currentPlayer) {
          return
        }
        const normalizedError = toRtspFlvPlayerError(mediaPlayerError)
        if (!startupPlaybackConfirmed) {
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
      currentPlayer.onMetadataArrived = (metadata) => {
        if (!isOperationCurrent(token) || player !== currentPlayer) {
          return
        }
        callbacks.onMetadataArrived?.(metadata)
      }

      player?.destroy()
      player = currentPlayer
      currentPlayer.attachMediaElement(videoRef.value)
      currentPlayer.load()
      if (options.autoPlay ?? true) {
        await currentPlayer.play()
      }
      if (!isOperationCurrent(token) || player !== currentPlayer) {
        currentPlayer.destroy()
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
      currentPlayer?.destroy()
      if (!isOperationCurrent(token)) {
        return
      }
      resetStartupGuard()
      const clientError = caughtError instanceof ClientError ? caughtError : undefined
      const nextError: RtspFlvPlayerError = {
        type: 'client',
        code: clientError?.code ?? 'PLAYER_START_FAILED',
        message: caughtError instanceof Error ? caughtError.message : String(caughtError),
        requestId: clientError?.requestId,
        detail: {
          status: clientError?.status,
          detail: clientError?.detail,
        },
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
