import type { NormalizedStreamCreateRequest } from '../../types.js'
import { maskRtspUrl } from '../../lib/index.js'

export interface FFmpegCommand {
  cmd: string
  args: string[]
  safePreview: string
}

export type VideoPlan = 'copy' | 'transcode'

function resolveVideoCodec(req: NormalizedStreamCreateRequest): string {
  return req.video.codec
}

export function buildFfmpegCommand(ffmpegPath: string, req: NormalizedStreamCreateRequest, plan?: VideoPlan): FFmpegCommand {
  const args: string[] = ['-hide_banner', '-loglevel', 'warning', '-rtsp_transport', req.transport, '-timeout', String(req.ioTimeoutUs), '-i', req.url]

  if (!req.audio.enabled || req.audio.mode === 'drop') {
    args.push('-an')
  } else if (req.audio.mode === 'copy') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', req.audio.codec, '-b:a', `${req.audio.bitrateKbps}k`)
  }

  const videoMode = plan ?? (req.video.mode === 'copy' ? 'copy' : 'transcode')
  if (videoMode === 'copy') {
    args.push('-c:v', 'copy')
  } else {
    args.push('-c:v', resolveVideoCodec(req), '-preset', 'veryfast', '-tune', 'zerolatency')
  }

  args.push('-f', 'flv', '-flvflags', 'no_duration_filesize', 'pipe:1')

  return {
    cmd: ffmpegPath,
    args,
    safePreview: [ffmpegPath, ...args.map((part) => maskRtspUrl(part))].join(' '),
  }
}

export function resolveVideoPlan(req: NormalizedStreamCreateRequest, attempt: number): VideoPlan {
  if (req.video.mode === 'copy') {
    return 'copy'
  }

  if (req.video.mode === 'transcode') {
    return 'transcode'
  }

  return attempt === 1 ? 'copy' : 'transcode'
}
