import type { NormalizedStreamCreateRequest } from '../../types.js'
import { maskRtspUrl } from '../../lib/index.js'

export interface FFmpegCommand {
  cmd: string
  args: string[]
  safePreview: string
}

export type VideoPlan = 'copy' | 'transcode'
export type RequestedVideoMode = 'auto' | 'transcode'
export type RequestedVideoCodec = 'h264' | 'h265'
export type InputVideoCodec = RequestedVideoCodec | 'unknown'

export interface FFmpegStrategyOptions {
  decoder: 'auto' | 'software' | 'hardware'
  encoder: 'auto' | 'software' | 'hardware'
  hardwareVendor: 'nvidia'
}

function resolveVideoCodec(req: NormalizedStreamCreateRequest): 'h264' | 'h265' {
  return req.video.codec
}

function resolveCodecFamily(codec: 'h264' | 'h265'): CodecFamily {
  return codec
}

type CodecFamily = 'h264' | 'h265'

interface CodecTemplateSpec {
  codec: string
  args: string[]
}

interface DecoderTemplateSpec {
  args: string[]
}

interface EncoderTemplateVariant {
  software: CodecTemplateSpec
  hardware: Record<FFmpegStrategyOptions['hardwareVendor'], CodecTemplateSpec>
}

type EncoderTemplateGroup = Record<CodecFamily, EncoderTemplateVariant>
type DecoderTemplateGroup = Record<CodecFamily, Record<FFmpegStrategyOptions['hardwareVendor'], DecoderTemplateSpec>>

const ENCODER_TEMPLATE_GROUP: EncoderTemplateGroup = {
  h264: {
    software: {
      codec: 'libx264',
      args: ['-preset', 'veryfast', '-tune', 'zerolatency'],
    },
    hardware: {
      nvidia: {
        codec: 'h264_nvenc',
        args: ['-preset', 'p4'],
      },
    },
  },
  h265: {
    software: {
      codec: 'libx265',
      args: ['-preset', 'veryfast', '-tune', 'zerolatency'],
    },
    hardware: {
      nvidia: {
        codec: 'hevc_nvenc',
        args: ['-preset', 'p4'],
      },
    },
  },
}

const DECODER_TEMPLATE_GROUP: DecoderTemplateGroup = {
  h264: {
    nvidia: {
      args: ['-hwaccel', 'cuda', '-c:v', 'h264_cuvid'],
    },
  },
  h265: {
    nvidia: {
      args: ['-hwaccel', 'cuda', '-c:v', 'hevc_cuvid'],
    },
  },
}

function resolveEncoderTemplateVariant(strategy: FFmpegStrategyOptions): 'software' | 'hardware' {
  if (strategy.encoder === 'hardware') {
    return 'hardware'
  }
  return 'software'
}

function resolveTranscodeEncoder(req: NormalizedStreamCreateRequest, strategy: FFmpegStrategyOptions): CodecTemplateSpec {
  const outputCodec = resolveCodecFamily(resolveVideoCodec(req))
  const variant = resolveEncoderTemplateVariant(strategy)
  if (variant === 'hardware') {
    return ENCODER_TEMPLATE_GROUP[outputCodec].hardware[strategy.hardwareVendor]
  }
  return ENCODER_TEMPLATE_GROUP[outputCodec].software
}

function resolveHardwareDecoder(inputCodec: RequestedVideoCodec, strategy: FFmpegStrategyOptions): DecoderTemplateSpec {
  return DECODER_TEMPLATE_GROUP[inputCodec][strategy.hardwareVendor]
}

export function buildFfmpegCommand(
  ffmpegPath: string,
  req: NormalizedStreamCreateRequest,
  plan: VideoPlan,
  inputCodec: InputVideoCodec = 'unknown',
  strategy: FFmpegStrategyOptions = { decoder: 'auto', encoder: 'auto', hardwareVendor: 'nvidia' }
): FFmpegCommand {
  const args: string[] = ['-hide_banner', '-loglevel', 'warning']

  if (plan === 'transcode' && strategy.decoder === 'hardware' && inputCodec !== 'unknown') {
    const decoder = resolveHardwareDecoder(inputCodec, strategy)
    args.push(...decoder.args)
  }

  args.push('-rtsp_transport', req.transport, '-timeout', String(req.ioTimeoutUs), '-i', req.url)

  if (!req.audio.enabled || req.audio.mode === 'drop') {
    args.push('-an')
  } else if (req.audio.mode === 'copy') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', req.audio.codec, '-b:a', `${req.audio.bitrateKbps}k`)
  }

  if (plan === 'copy') {
    args.push('-c:v', 'copy')
  } else {
    const encoder = resolveTranscodeEncoder(req, strategy)
    args.push('-c:v', encoder.codec, ...encoder.args)
  }

  args.push('-f', 'flv', '-flvflags', 'no_duration_filesize', 'pipe:1')

  return {
    cmd: ffmpegPath,
    args,
    safePreview: [ffmpegPath, ...args.map((part) => maskRtspUrl(part))].join(' '),
  }
}

export function resolveVideoPlan(
  attempt: number,
  requestedMode: RequestedVideoMode,
  requestedCodec: RequestedVideoCodec,
  inputCodec: InputVideoCodec
): VideoPlan {
  if (requestedMode === 'transcode') {
    return 'transcode'
  }
  if (attempt > 1) {
    return 'transcode'
  }
  if (inputCodec === requestedCodec) {
    return 'copy'
  }
  return 'transcode'
}
