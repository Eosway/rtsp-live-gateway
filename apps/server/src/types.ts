import type { AudioCodec, ResolvedAudioOptions, ResolvedVideoOptions, RtspTransport, StreamCreateRequest } from '@eosway/rtsp-live-gateway-protocol'

export type ResolvedAudioPlan =
  | {
      enabled: false
    }
  | {
      enabled: true
      mode: 'copy'
    }
  | {
      enabled: true
      mode: 'transcode'
      codec: AudioCodec
    }

export interface ProbedInputMedia {
  video: 'h264' | 'h265' | 'unknown'
  audio: AudioCodec | 'unknown'
}

export interface ResolvedStreamCreateRequest extends StreamCreateRequest {
  transport: RtspTransport
  video: ResolvedVideoOptions
  audio: ResolvedAudioOptions
}
