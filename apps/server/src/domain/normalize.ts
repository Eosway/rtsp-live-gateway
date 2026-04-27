import type { AudioOptions, RtspTransport, StreamCreateRequest, VideoOptions } from '@rtsp-gateway/protocol'
import { ApiError } from '../errors.js'
import type { NormalizedStreamCreateRequest } from '../types.js'

const DEFAULT_TRANSPORT: RtspTransport = 'tcp'
const DEFAULT_VIDEO: Required<VideoOptions> = {
  mode: 'auto',
  forceCodec: 'h264',
  width: 0,
  height: 0,
  fps: 0,
  bitrateKbps: 0,
  gop: 0,
}
const DEFAULT_AUDIO: Required<AudioOptions> = {
  enabled: false,
  mode: 'drop',
  codec: 'aac',
  bitrateKbps: 0,
}

function assertPositiveNumber(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError('INVALID_ARGUMENT', `Invalid field: ${field}`)
  }
}

export function normalizeCreateRequest(raw: unknown): NormalizedStreamCreateRequest {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('INVALID_ARGUMENT', 'Request body must be an object')
  }
  const body = raw as StreamCreateRequest
  if (!body.url || typeof body.url !== 'string') {
    throw new ApiError('INVALID_ARGUMENT', 'url is required')
  }

  const transport = body.transport ?? DEFAULT_TRANSPORT
  if (!['tcp', 'udp', 'udp_multicast', 'http', 'https'].includes(transport)) {
    throw new ApiError('INVALID_ARGUMENT', 'Invalid transport')
  }

  const connectTimeoutMs = body.connectTimeoutMs ?? 5000
  const ioTimeoutUs = body.ioTimeoutUs ?? 5_000_000
  assertPositiveNumber(connectTimeoutMs, 'connectTimeoutMs')
  assertPositiveNumber(ioTimeoutUs, 'ioTimeoutUs')

  return {
    url: body.url,
    transport,
    connectTimeoutMs,
    ioTimeoutUs,
    video: { ...DEFAULT_VIDEO, ...(body.video ?? {}) },
    audio: { ...DEFAULT_AUDIO, ...(body.audio ?? {}) },
    allowPrivateIp: body.allowPrivateIp ?? false,
    labels: body.labels ?? {},
  }
}
