import type { StreamCreateRequest } from '@rtsp-gateway/protocol'

export interface NormalizedStreamCreateRequest extends StreamCreateRequest {
  transport: 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https'
  connectTimeoutMs: number
  ioTimeoutUs: number
  video: Required<NonNullable<StreamCreateRequest['video']>>
  audio: Required<NonNullable<StreamCreateRequest['audio']>>
  allowPrivateIp: boolean
  labels: Record<string, string>
}
