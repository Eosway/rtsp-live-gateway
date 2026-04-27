import { spawnSync } from 'node:child_process'
import { ApiError } from '../../errors.js'

function canRun(binary: string): boolean {
  const result = spawnSync(binary, ['-version'], { stdio: 'ignore' })
  return result.status === 0
}

export async function resolveFfmpegPath(nodeEnv: string): Promise<string> {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH
  }

  if (canRun('ffmpeg')) {
    return 'ffmpeg'
  }

  if (nodeEnv !== 'production') {
    try {
      const fallback = await import('@ffmpeg-installer/ffmpeg')
      if (fallback.path) {
        return fallback.path
      }
    } catch {
      // ignore and throw unified error below
    }
  }

  throw new ApiError('FFMPEG_NOT_FOUND', 'FFmpeg executable not found')
}
