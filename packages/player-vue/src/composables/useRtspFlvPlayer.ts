import { ClientError, buildLiveUrl, createStream } from '@eosway/rtsp-live-gateway-client'
import { shallowRef } from 'vue'
import { createPlayer, isSupported } from '../player/index.js'
import type {
  PlayerHandle,
  PlayerError,
  RtspFlvPlayerCallbacks,
  RtspFlvPlayerController,
  RtspFlvPlayerError,
  RtspFlvPlayerOptions,
  RtspFlvPlayerStatus,
  RtspFlvPlayerStream,
} from '../types.js'

type OptionsSource = RtspFlvPlayerOptions | (() => RtspFlvPlayerOptions)

export function useRtspFlvPlayer(optionsSource: OptionsSource, callbacks: RtspFlvPlayerCallbacks = {}): RtspFlvPlayerController {
  const stream = shallowRef<RtspFlvPlayerStream>()
  const status = shallowRef<RtspFlvPlayerStatus>('idle')
  const error = shallowRef<RtspFlvPlayerError>()
  let video: HTMLVideoElement | undefined
  let player: PlayerHandle | undefined
  let operation: Promise<void> = Promise.resolve()
  let generation = 0

  const resolveOptions = (): RtspFlvPlayerOptions => (typeof optionsSource === 'function' ? optionsSource() : optionsSource)
  const isCurrent = (token: number) => token === generation

  function attach(nextVideo: HTMLVideoElement): void {
    video = nextVideo
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    const next = operation.catch(() => undefined).then(task)
    operation = next.catch(() => undefined)
    return next
  }

  function reportError(nextError: RtspFlvPlayerError): void {
    error.value = nextError
    status.value = 'error'
    callbacks.onError?.(nextError)
  }

  function normalizePlayerError(nextError: PlayerError): RtspFlvPlayerError {
    return {
      type: 'player',
      code: nextError.code,
      message: nextError.message,
      detail: nextError,
      cause: nextError,
    }
  }

  function normalizeThrownError(caught: unknown): RtspFlvPlayerError {
    if (caught instanceof ClientError) {
      return {
        type: 'client',
        code: caught.code ?? 'STREAM_CREATE_FAILED',
        message: caught.message,
        requestId: caught.requestId,
        detail: { status: caught.status, detail: caught.detail },
        cause: caught,
      }
    }
    return {
      type: 'player',
      code: caught instanceof Error && caught.name !== 'Error' ? caught.name : 'PLAYER_OPERATION_FAILED',
      message: caught instanceof Error ? caught.message : String(caught),
      cause: caught,
    }
  }

  function bindPlayerEvents(current: PlayerHandle, token: number): void {
    const onStopped = () => {
      if (!isCurrent(token) || player !== current) return
      status.value = 'stopped'
      callbacks.onStopped?.()
    }
    const onDestroyed = () => {
      if (!isCurrent(token) || player !== current) return
      status.value = 'destroyed'
      callbacks.onDestroyed?.()
    }
    const onError = (payload: PlayerError) => {
      if (!isCurrent(token) || player !== current) return
      reportError(normalizePlayerError(payload))
    }
    current.on('stopped', onStopped)
    current.on('destroyed', onDestroyed)
    current.on('error', onError)
    current.on('mediaInfo', (payload) => callbacks.onMediaInfo?.(payload))
    current.on('warning', (payload) => callbacks.onWarning?.(payload))
    current.on('reconnecting', (payload) => callbacks.onReconnecting?.(payload))
    current.on('recovered', (payload) => callbacks.onRecovered?.(payload))
  }

  async function startInternal(): Promise<void> {
    if (status.value === 'starting' || status.value === 'started') return
    const token = ++generation
    const options = resolveOptions()
    status.value = 'starting'
    error.value = undefined
    let current: PlayerHandle | undefined
    try {
      if (!video) throw new Error('Video element is not attached')
      if (!isSupported()) throw new Error('Rivmux is not supported in this browser')
      if (!stream.value) stream.value = await createStream(options.serverUrl, options.sourceConfig)
      if (!isCurrent(token)) return
      const currentStream = stream.value
      current = createPlayer(buildLiveUrl(options.serverUrl, currentStream.streamId), options.playerOptions)
      bindPlayerEvents(current, token)
      await player?.destroy()
      player = current
      await current.attach(video)
      await current.start()
      if (!isCurrent(token) || player !== current) {
        await current.destroy()
        return
      }
      status.value = 'started'
      callbacks.onStarted?.()
    } catch (caught) {
      if (current && player === current) player = undefined
      await current?.destroy()
      if (isCurrent(token)) reportError(normalizeThrownError(caught))
    }
  }

  function start(): Promise<void> {
    return enqueue(startInternal)
  }

  function stop(): Promise<void> {
    return enqueue(async () => {
      await player?.stop()
    })
  }

  function restart(): Promise<void> {
    return enqueue(async () => {
      ++generation
      await player?.destroy()
      player = undefined
      stream.value = undefined
      status.value = 'idle'
      await startInternal()
    })
  }

  function destroy(): Promise<void> {
    return enqueue(async () => {
      ++generation
      const current = player
      player = undefined
      await current?.destroy()
      status.value = 'destroyed'
      callbacks.onDestroyed?.()
    })
  }

  return { stream, status, error, attach, start, stop, restart, destroy }
}
