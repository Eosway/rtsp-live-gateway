import type {
  MediaInfo,
  PlayerError,
  PlayerEventListener,
  PlayerEventType as RivmuxPlayerEventType,
  PlayerStats,
  PlayerWarning,
  ReconnectInfo,
  RecoveryInfo,
  RivmuxPlayerOptions,
} from 'rivmux'
import type { StreamCreateRequest, StreamCreateResponse as RtspFlvPlayerStream } from '@eosway/rtsp-live-gateway-client'
import type { ShallowRef } from 'vue'

export type RtspFlvPlayerStatus = 'idle' | 'starting' | 'started' | 'stopped' | 'error' | 'destroyed'

export interface RtspFlvPlayerOptions {
  serverUrl: string
  sourceConfig: StreamCreateRequest
  playerOptions?: RivmuxPlayerOptions
}

export interface RtspFlvPlayerError {
  type: 'client' | 'player'
  code: string
  message: string
  requestId?: string
  detail?: unknown
  cause?: unknown
}

export interface RtspFlvPlayerCallbacks {
  onStarted?: () => void
  onStopped?: () => void
  onDestroyed?: () => void
  onError?: (error: RtspFlvPlayerError) => void
  onMediaInfo?: (mediaInfo: MediaInfo) => void
  onWarning?: (warning: PlayerWarning) => void
  onReconnecting?: (info: ReconnectInfo) => void
  onRecovered?: (info: RecoveryInfo) => void
}

export interface RtspFlvPlayerController {
  readonly stream: Readonly<ShallowRef<RtspFlvPlayerStream | undefined>>
  readonly status: Readonly<ShallowRef<RtspFlvPlayerStatus>>
  readonly error: Readonly<ShallowRef<RtspFlvPlayerError | undefined>>
  attach(video: HTMLVideoElement): void
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  destroy(): Promise<void>
}

export interface PlayerHandle {
  attach(video: HTMLVideoElement): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  destroy(): Promise<void>
  on<T extends RivmuxPlayerEventType>(type: T, listener: PlayerEventListener<T>): void
  off<T extends RivmuxPlayerEventType>(type: T, listener: PlayerEventListener<T>): void
}

export type { MediaInfo, PlayerError, PlayerStats, PlayerWarning, ReconnectInfo, RecoveryInfo, RivmuxPlayerOptions, RtspFlvPlayerStream }
