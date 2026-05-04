import type { NormalizedStreamCreateRequest } from '../../types.js'
import { maskRtspUrl } from '../../lib/index.js'

export interface FFmpegCommand {
  cmd: string
  args: string[]
  safePreview: string
}

export type VideoPlan = 'copy' | 'transcode'

export interface FFmpegStrategyOptions {
  decoder: 'auto' | 'software' | 'hardware'
  encoder: 'auto' | 'software' | 'hardware'
  hardwareVendor: 'nvidia'
}

function resolveVideoCodec(req: NormalizedStreamCreateRequest): string {
  return req.video.codec
}

type CodecFamily = 'h264' | 'h265'

interface CodecTemplateSpec {
  codec: string
  args: string[]
}

interface EncoderTemplateVariant {
  software: CodecTemplateSpec
  hardware: Record<FFmpegStrategyOptions['hardwareVendor'], CodecTemplateSpec>
}

type EncoderTemplateGroup = Record<CodecFamily, EncoderTemplateVariant>

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

function resolveTranscodeEncoder(req: NormalizedStreamCreateRequest, strategy: FFmpegStrategyOptions): CodecTemplateSpec {
  const outputCodec: CodecFamily = resolveVideoCodec(req) === 'libx265' ? 'h265' : 'h264'
  if (strategy.encoder === 'hardware') {
    return ENCODER_TEMPLATE_GROUP[outputCodec].hardware[strategy.hardwareVendor]
  }
  return ENCODER_TEMPLATE_GROUP[outputCodec].software
}

export function buildFfmpegCommand(
  ffmpegPath: string,
  req: NormalizedStreamCreateRequest,
  plan?: VideoPlan,
  strategy: FFmpegStrategyOptions = { decoder: 'auto', encoder: 'auto', hardwareVendor: 'nvidia' }
): FFmpegCommand {
  const args: string[] = ['-hide_banner', '-loglevel', 'warning', '-rtsp_transport', req.transport, '-timeout', String(req.ioTimeoutUs), '-i', req.url]

  if (!req.audio.enabled || req.audio.mode === 'drop') {
    args.push('-an')
  } else if (req.audio.mode === 'copy') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', req.audio.codec, '-b:a', `${req.audio.bitrateKbps}k`)
  }

  const videoMode = plan ?? 'transcode'
  if (videoMode === 'copy') {
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

export function resolveVideoPlan(attempt: number): VideoPlan {
  return attempt === 1 ? 'copy' : 'transcode'
}
