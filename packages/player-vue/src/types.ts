import type { StreamCreateRequest } from '@rtsp-gateway/client'

export type PlayerSourceMode = 'streamId' | 'create'

export interface RtspFlvPlayerProps {
  baseUrl: string
  mode: PlayerSourceMode
  streamId?: string
  createRequest?: StreamCreateRequest
  autoplay?: boolean
  muted?: boolean
  stashBuffer?: boolean
  destroyOnUnmount?: boolean
}

export interface RtspFlvPlayerError {
  code: string
  message: string
}
