import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

function canRun(binary: string): boolean {
  const result = spawnSync(binary, ['-version'], { stdio: 'ignore' })
  return result.status === 0
}

function inferSiblingFfprobe(ffmpegPath: string): string | undefined {
  if (ffmpegPath === 'ffmpeg') {
    return canRun('ffprobe') ? 'ffprobe' : undefined
  }
  const sibling = join(dirname(ffmpegPath), 'ffprobe')
  return canRun(sibling) ? sibling : undefined
}

export function resolveFfprobePath(ffmpegPath: string): string | undefined {
  if (process.env.FFPROBE_PATH && canRun(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH
  }
  return inferSiblingFfprobe(ffmpegPath)
}
