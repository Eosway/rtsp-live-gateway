import type { StreamCreateRequest } from '@eosway/rtsp-live-gateway-client'
import type { MediaInfo as RivmuxMediaInfo, RivmuxPlayerOptions } from 'rivmux'
import type { Ref, ShallowRef } from 'vue'

export type RtspFlvPlayerStatus = 'idle' | 'starting' | 'running' | 'error'
export type MediaInfo = RivmuxMediaInfo

export interface RtspFlvPlayerProps {
  serverUrl: string
  sourceConfig: StreamCreateRequest
  autoPlay?: boolean
  playerOptions?: RivmuxPlayerOptions
  cleanOnUnmount?: boolean
}

export interface RtspFlvPlayerError {
  type: 'client' | 'media_player'
  code: string
  message: string
  requestId?: string
  detail?: unknown
  cause?: unknown
}

export type UseRtspFlvPlayerOptions = RtspFlvPlayerProps

export interface UseRtspFlvPlayerCallbacks {
  onCreated?: (streamId: string) => void
  onReady?: () => void
  onError?: (error: RtspFlvPlayerError) => void
  onMediaInfo?: (mediaInfo: MediaInfo) => void
  onClosed?: (reason: string) => void
}

export interface UseRtspFlvPlayerReturn {
  videoRef: ShallowRef<HTMLVideoElement | undefined>
  streamId: Ref<string | undefined>
  status: Ref<RtspFlvPlayerStatus>
  error: Ref<RtspFlvPlayerError | undefined>
  attach(videoEl: HTMLVideoElement): void
  detach(reason?: string): Promise<void>
  start(): Promise<void>
  stop(reason?: string): Promise<void>
  reload(reason?: string): Promise<void>
}

export interface MediaPlayerError {
  code: string
  message: string
  detail?: unknown
  terminal?: boolean
}

export interface MediaPlayer {
  onError?: (error: MediaPlayerError) => void
  onMediaInfo?: (mediaInfo: MediaInfo) => void

  attach(mediaElement: HTMLVideoElement): Promise<void>
  start(): Promise<void>
  destroy(): Promise<void>
}
