import { spawn } from 'node:child_process'
import type { AudioCodec } from '@eosway/rtsp-live-gateway-protocol'

export type ProbedVideoCodec = 'h264' | 'h265' | 'unknown'
export type ProbedAudioCodec = AudioCodec | 'unknown'

export interface FFprobeInput {
  transport: 'tcp' | 'udp' | 'udp_multicast' | 'http' | 'https'
  ioTimeoutMs: number
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

function normalizeAudioCodec(codecName: string | undefined): ProbedAudioCodec {
  if (!codecName) {
    return 'unknown'
  }
  const lowered = codecName.toLowerCase()
  if (lowered === 'aac') {
    return 'aac'
  }
  if (lowered === 'mp3') {
    return 'mp3'
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
        String(input.ioTimeoutMs * 1000),
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

  async probeAudioCodec(input: FFprobeInput): Promise<ProbedAudioCodec> {
    return new Promise((resolve) => {
      const args = [
        '-v',
        'error',
        '-rtsp_transport',
        input.transport,
        '-timeout',
        String(input.ioTimeoutMs * 1000),
        '-select_streams',
        'a:0',
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
        resolve(normalizeAudioCodec(codecName))
      })
    })
  }
}
