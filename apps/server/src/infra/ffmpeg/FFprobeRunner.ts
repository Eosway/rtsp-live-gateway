import { spawn } from 'node:child_process'

export type ProbedVideoCodec = 'h264' | 'h265' | 'unknown'

export interface FFprobeInput {
  transport: 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https'
  ioTimeoutUs: number
  url: string
}

function normalizeCodec(codecName: string | undefined): ProbedVideoCodec {
  if (!codecName) {
    return 'unknown'
  }
  const lowered = codecName.toLowerCase()
  if (lowered === 'h264') {
    return 'h264'
  }
  if (lowered === 'hevc' || lowered === 'h265') {
    return 'h265'
  }
  return 'unknown'
}

export class FFprobeRunner {
  private readonly ffprobePath: string

  constructor(ffprobePath: string) {
    this.ffprobePath = ffprobePath
  }

  async probeVideoCodec(input: FFprobeInput): Promise<ProbedVideoCodec> {
    return new Promise((resolve) => {
      const args = [
        '-v',
        'error',
        '-rtsp_transport',
        input.transport,
        '-timeout',
        String(input.ioTimeoutUs),
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        input.url,
      ]

      const child = spawn(this.ffprobePath, args, {
        stdio: ['ignore', 'pipe', 'ignore'],
      })

      let stdout = ''
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })

      child.once('error', () => {
        resolve('unknown')
      })

      child.once('exit', (code) => {
        if (code !== 0) {
          resolve('unknown')
          return
        }
        const codecName = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean)
        resolve(normalizeCodec(codecName))
      })
    })
  }
}
