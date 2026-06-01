import { serve } from '@hono/node-server'
import { readFileSync } from 'node:fs'
import { createSecureServer as createHttp2SecureServer } from 'node:http2'
import { createApp } from './app.js'
import { loadServerConfig, type ServerConfig } from './config.js'
import { resolveFfmpegPath } from './infra/ffmpeg/resolveFfmpegPath.js'
import { resolveFfprobePath } from './infra/ffmpeg/resolveFfprobePath.js'

function getServerOptions(config: ServerConfig) {
  if (!config.httpsEnabled) {
    return {}
  }

  return {
    createServer: createHttp2SecureServer,
    serverOptions: {
      key: readFileSync(config.tlsKeyPath!, 'utf8'),
      cert: readFileSync(config.tlsCertPath!, 'utf8'),
      allowHTTP1: config.http2AllowHttp1,
    },
  }
}

const config = loadServerConfig()
const ffmpegPath = await resolveFfmpegPath(config.nodeEnv)
const ffprobePath = resolveFfprobePath(ffmpegPath)
const app = createApp({ config, ffmpegPath, ffprobePath })
const serverOptions = getServerOptions(config)

serve(
  {
    fetch: app.fetch,
    port: config.port,
    ...serverOptions,
  },
  (info) => {
    process.stdout.write(
      `${JSON.stringify({
        level: 'info',
        message: 'server_started',
        detail: {
          port: info.port,
          protocol: config.httpsEnabled ? 'https' : 'http',
          tlsEnabled: config.httpsEnabled,
          http2Enabled: config.httpsEnabled,
          http2AllowHttp1: config.httpsEnabled ? config.http2AllowHttp1 : undefined,
          ffmpegPath,
          ffprobePath,
        },
      })}\n`
    )
  }
)
