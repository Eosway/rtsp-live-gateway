import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadServerConfig } from './config.js'
import { resolveFfmpegPath } from './infra/ffmpeg/resolveFfmpegPath.js'
import { resolveFfprobePath } from './infra/ffmpeg/resolveFfprobePath.js'

const config = loadServerConfig()
const ffmpegPath = await resolveFfmpegPath(config.nodeEnv)
const ffprobePath = resolveFfprobePath(ffmpegPath)
const app = createApp({ config, ffmpegPath, ffprobePath })

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    process.stdout.write(
      `${JSON.stringify({
        level: 'info',
        message: 'server_started',
        detail: {
          port: info.port,
          ffmpegPath,
          ffprobePath,
        },
      })}\n`
    )
  }
)
