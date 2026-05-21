import { sha256 } from '../lib/index.js'
import type { ResolvedStreamCreateRequest } from '../types.js'

export function buildSourceKey(req: ResolvedStreamCreateRequest): string {
  return sha256(
    JSON.stringify({
      url: req.url,
      transport: req.transport,
      video: req.video,
      audio: req.audio,
    })
  )
}
