import type { AudioCodec, AudioMode, RtspTransport, StreamCreateRequest } from '@eosway/rtsp-live-gateway-protocol'
import { ApiError } from '../errors.js'
import type { ResolvedStreamCreateRequest } from '../types.js'

const DEFAULT_TRANSPORT: RtspTransport = 'tcp'
const DEFAULT_VIDEO_MODE: 'auto' | 'transcode' = 'auto'
const DEFAULT_VIDEO_CODEC: 'h264' | 'h265' = 'h264'
const DEFAULT_AUDIO_ENABLED = false
const DEFAULT_AUDIO_MODE: AudioMode = 'auto'
const DEFAULT_AUDIO_CODEC: AudioCodec = 'aac'

function resolveAudioOptions(audio: StreamCreateRequest['audio']): ResolvedStreamCreateRequest['audio'] {
  const audioEnabled = audio?.enabled ?? DEFAULT_AUDIO_ENABLED
  const requestedAudioMode = audio && typeof audio === 'object' && 'mode' in audio ? audio.mode : undefined
  const requestedAudioCodec = audio && typeof audio === 'object' && 'codec' in audio ? audio.codec : undefined

  if (typeof audioEnabled !== 'boolean') {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid audio.enabled', { field: 'audio.enabled' })
  }

  if (!audioEnabled) {
    if (requestedAudioMode !== undefined) {
      throw new ApiError('INVALID_ARGUMENT', 'audio.mode requires audio.enabled = true', { field: 'audio.mode' })
    }
    if (requestedAudioCodec !== undefined) {
      throw new ApiError('INVALID_ARGUMENT', 'audio.codec requires audio.enabled = true', { field: 'audio.codec' })
    }
    return {
      enabled: false,
    }
  }

  const audioMode = requestedAudioMode ?? DEFAULT_AUDIO_MODE
  if (audioMode !== 'auto' && audioMode !== 'transcode') {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid audio.mode', { field: 'audio.mode' })
  }

  const audioCodec = requestedAudioCodec ?? DEFAULT_AUDIO_CODEC
  if (audioCodec !== 'aac' && audioCodec !== 'mp3') {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid audio.codec', { field: 'audio.codec' })
  }

  return {
    enabled: true,
    mode: audioMode,
    codec: audioCodec,
  }
}

export function resolveStreamCreateRequest(raw: unknown): ResolvedStreamCreateRequest {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('INVALID_ARGUMENT', 'Request body must be an object')
  }
  const body = raw as StreamCreateRequest
  if (!body.url || typeof body.url !== 'string') {
    throw new ApiError('INVALID_ARGUMENT', 'url is required', { field: 'url' })
  }

  const transport = body.transport ?? DEFAULT_TRANSPORT
  if (!['tcp', 'udp', 'udp_multicast', 'http', 'https'].includes(transport)) {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid transport', { field: 'transport' })
  }

  const videoMode = body.video?.mode ?? DEFAULT_VIDEO_MODE
  if (!['auto', 'transcode'].includes(videoMode)) {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid video.mode', { field: 'video.mode' })
  }

  const videoCodec = body.video?.codec ?? DEFAULT_VIDEO_CODEC
  if (!['h264', 'h265'].includes(videoCodec)) {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid video.codec', { field: 'video.codec' })
  }

  return {
    url: body.url,
    transport,
    video: {
      mode: videoMode,
      codec: videoCodec,
    },
    audio: resolveAudioOptions(body.audio),
  }
}
