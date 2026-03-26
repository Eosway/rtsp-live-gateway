export type StreamId = string;
export type SourceKey = string;
export type SessionId = string;

export type RtspTransport = "tcp" | "udp" | "udp_multicast" | "http" | "https";

export type VideoMode = "auto" | "copy" | "transcode";
export type AudioMode = "drop" | "copy" | "transcode";

export type StreamState = "idle" | "starting" | "running" | "stopping" | "error";

export interface VideoOptions {
  mode?: VideoMode;
  forceCodec?: "h264";
  width?: number;
  height?: number;
  fps?: number;
  bitrateKbps?: number;
  gop?: number;
}

export interface AudioOptions {
  enabled?: boolean;
  mode?: AudioMode;
  codec?: "aac";
  bitrateKbps?: number;
}

export interface StreamCreateRequest {
  url: string;
  transport?: RtspTransport;
  connectTimeoutMs?: number;
  ioTimeoutUs?: number;
  video?: VideoOptions;
  audio?: AudioOptions;
  allowPrivateIp?: boolean;
  labels?: Record<string, string>;
}

export interface StreamCreateResponse {
  streamId: StreamId;
  state: StreamState;
  playUrl: string;
  reused: boolean;
  createdAt: string;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  detail?: Record<string, unknown>;
}

export interface StreamStatusResponse {
  streamId: StreamId;
  state: StreamState;
  viewerCount: number;
  createdAt: string;
  startedAt?: string;
  lastActiveAt?: string;
  sourceKey?: SourceKey;
  config: {
    transport: RtspTransport;
    video: Required<VideoOptions>;
    audio: Required<AudioOptions>;
  };
  stats: {
    bytesOut: number;
    ffmpegPid?: number;
    startAttempts: number;
    startLatencyMs?: number;
    lastErrorAt?: string;
  };
  recentError?: ApiErrorBody;
}

export type ApiErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_RTSP_URL"
  | "SSRF_BLOCKED"
  | "STREAM_NOT_FOUND"
  | "STREAM_DELETED"
  | "STREAM_START_TIMEOUT"
  | "UPSTREAM_AUTH_FAILED"
  | "UPSTREAM_CONNECT_FAILED"
  | "NO_MEDIA_OUTPUT"
  | "FFMPEG_NOT_FOUND"
  | "FFMPEG_UNSUPPORTED"
  | "FFMPEG_EXITED"
  | "INTERNAL_ERROR";

