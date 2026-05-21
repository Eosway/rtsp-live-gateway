import type { ApiErrorBody } from './errors.js'

export type StreamId = string
/** 服务端内部复用键 */
export type SourceKey = string
/** 单个播放连接标识 */
export type SessionId = string

export type RtspTransport = 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https'

export type VideoCodec = 'h264' | 'h265'
export type VideoMode = 'auto' | 'transcode'
export type AudioCodec = 'aac' | 'mp3'
export type AudioMode = 'auto' | 'transcode'

export type StreamState = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export interface VideoOptions {
  /** 视频模式 */
  mode?: VideoMode
  /** 目标视频 codec */
  codec?: VideoCodec
}

export type AudioOptions =
  | {
      /** 关闭音频 */
      enabled?: false
    }
  | {
      /** 开启音频 */
      enabled: true
      mode?: AudioMode
      /** 目标音频 codec */
      codec?: AudioCodec
    }

/** 创建流请求 */
export interface StreamCreateRequest {
  url: string
  transport?: RtspTransport
  video?: VideoOptions
  audio?: AudioOptions
}

/** 创建流响应 */
export interface StreamCreateResponse {
  streamId: StreamId
  state: StreamState
  reused: boolean
  createdAt: string
}

export interface ResolvedVideoOptions {
  /** 归一化后的视频模式 */
  mode: NonNullable<VideoOptions['mode']>
  /** 归一化后的视频 codec */
  codec: NonNullable<VideoOptions['codec']>
}

export type ResolvedAudioOptions =
  | {
      /** 音频关闭 */
      enabled: false
    }
  | {
      /** 音频开启 */
      enabled: true
      mode: AudioMode
      codec: AudioCodec
    }

/** 归一化后的流配置，不包含上游 URL */
export interface ResolvedStreamConfig {
  transport: RtspTransport
  video: ResolvedVideoOptions
  audio: ResolvedAudioOptions
}

/** 单路流统计 */
export interface StreamStats {
  /** 累计扇出字节数 */
  bytesOutTotal: number
  /** 当前 FFmpeg 进程 pid */
  currentFfmpegPid?: number
  /** 累计启动尝试次数 */
  startAttemptsTotal: number
  /** 最近一次启动耗时 */
  lastStartLatencyMs?: number
  /** 最近一次错误时间 */
  lastErrorAt?: string
}

/** 单路流状态 */
export interface StreamStatusResponse {
  streamId: StreamId
  state: StreamState
  viewerCount: number
  createdAt: string
  /** 最近一次启动时间 */
  startedAt?: string
  /** 最近一次观众活动时间 */
  lastActiveAt?: string
  /** 归一化后的配置 */
  resolvedConfig: ResolvedStreamConfig
  /** 统计 */
  stats: StreamStats
  /** 最近一次结构化错误 */
  recentError?: ApiErrorBody
}

export type StreamListResponse = StreamStatusResponse[]

export type StreamDeleteResponse = void

export interface HealthzResponse {
  status: 'ok'
  ffmpegPath: string
  uptimeSec: number
}
