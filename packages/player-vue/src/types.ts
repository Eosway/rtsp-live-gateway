import MpegTs from 'mpegts.js'
import type { StreamCreateRequest } from '@rtsp-gateway/client'
import type { Ref, ShallowRef } from 'vue'

export type RtspFlvPlayerStatus = 'idle' | 'starting' | 'running' | 'error'

export interface RtspFlvPlayerProps {
  baseUrl: string
  sourceConfig: StreamCreateRequest
  autoPlay?: boolean
  playerConfig?: MediaPlayerConfig
  cleanOnUnmount?: boolean
}

export interface RtspFlvPlayerError {
  type: 'client' | 'media_player'
  code: string
  message: string
  detail?: unknown
  cause?: unknown
}

export type UseRtspFlvPlayerOptions = RtspFlvPlayerProps

export interface UseRtspFlvPlayerCallbacks {
  onCreated?: (streamId: string) => void
  onStateChange?: (state: RtspFlvPlayerStatus) => void
  onError?: (error: RtspFlvPlayerError) => void
  onMediaInfo?: (mediaInfo: MediaInfo) => void
  onMetadataArrived?: (metadata: unknown) => void
  onClosed?: (reason: string) => void
}

export interface UseRtspFlvPlayerReturn {
  videoRef: ShallowRef<HTMLVideoElement | undefined>
  streamId: Ref<string | undefined>
  state: Ref<RtspFlvPlayerStatus>
  error: Ref<RtspFlvPlayerError | undefined>
  attach(videoEl: HTMLVideoElement): void
  detach(reason?: string): Promise<void>
  start(): Promise<void>
  stop(reason?: string): Promise<void>
  reload(reason?: string): Promise<void>
}

export type MediaPlayerSource = MpegTs.MediaDataSource

export type MediaPlayerConfig = Partial<MpegTs.Config>

export interface MediaPlayerError {
  type: string
  detail: string
  info: unknown
}

export type MediaInfo = MpegTs.NativePlayerMediaInfo | MpegTs.MSEPlayerMediaInfo

export interface MediaPlayer {
  onError?: (error: MediaPlayerError) => void
  onMediaInfo?: (mediaInfo: MediaInfo) => void
  onMetadataArrived?: (metadata: unknown) => void

  attachMediaElement(mediaElement: HTMLVideoElement): void
  detachMediaElement(): void
  load(): void
  unload(): void
  play(): Promise<void>
  pause(): void
  destroy(): void
}
