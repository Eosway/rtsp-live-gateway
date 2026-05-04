import type { RtspTransport, StreamCreateRequest } from '@eosway/rtsp-live-gateway-protocol'

export interface NormalizedStreamCreateRequest extends StreamCreateRequest {
  transport: RtspTransport
  ioTimeoutUs: number
  video: {
    codec: 'libx264' | 'libx265'
  }
  audio: {
    enabled: boolean
    mode: 'drop' | 'copy'
    codec: 'aac'
    bitrateKbps: number
  }
  allowPrivateIp: boolean
  labels: Record<string, string>
}
