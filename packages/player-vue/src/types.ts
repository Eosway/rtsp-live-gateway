import type { StreamCreateRequest } from '@rtsp-gateway/client'
import type { Ref, ShallowRef } from 'vue'

export type RtspFlvPlayerStatus = 'idle' | 'starting' | 'running' | 'error'

interface RtspFlvPlayerBaseOptions {
  baseUrl: string
  sourceConfig: StreamCreateRequest
  autoPlay?: boolean
  stashBuffer?: boolean
  cleanOnUnmount?: boolean
}

export interface RtspFlvPlayerProps extends RtspFlvPlayerBaseOptions {
  muted?: boolean
}

export interface RtspFlvPlayerError {
  code: string
  message: string
  status?: number
  detail?: Record<string, unknown>
}

export type UseRtspFlvPlayerOptions = RtspFlvPlayerBaseOptions

export interface UseRtspFlvPlayerCallbacks {
  onCreated?: (streamId: string) => void
  onStateChange?: (state: RtspFlvPlayerStatus) => void
  onError?: (error: RtspFlvPlayerError) => void
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

export interface MpegtsPlayer {
  attach(videoEl: HTMLVideoElement, url: string, stashBuffer: boolean): Promise<void>
  play(): Promise<void>
  destroy(): void
}
