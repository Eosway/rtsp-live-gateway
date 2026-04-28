import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFfmpegCommand, resolveVideoPlan } from './FFmpegCommandBuilder.js'
import type { NormalizedStreamCreateRequest } from '../../types.js'

function createRequest(overrides: Partial<NormalizedStreamCreateRequest> = {}): NormalizedStreamCreateRequest {
  return {
    url: 'rtsp://admin:secret@example.com/live',
    transport: 'tcp',
    ioTimeoutUs: 5_000_000,
    video: {
      mode: 'auto',
      codec: 'libx264',
    },
    audio: {
      enabled: false,
      mode: 'drop',
      codec: 'aac',
      bitrateKbps: 0,
    },
    allowPrivateIp: false,
    labels: {},
    ...overrides,
  }
}

test('auto mode should copy on first attempt and transcode on retry', () => {
  const req = createRequest()
  assert.equal(resolveVideoPlan(req, 1), 'copy')
  assert.equal(resolveVideoPlan(req, 2), 'transcode')
})

test('copy mode should preserve video bitstream copy', () => {
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'copy',
        codec: 'libx265',
      },
    }),
    'copy'
  )

  const videoCodecIndex = command.args.indexOf('-c:v')
  assert.equal(command.args[videoCodecIndex + 1], 'copy')
})

test('transcode mode should select libx264 or libx265 from video.codec', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode')
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'transcode',
        codec: 'libx265',
      },
    }),
    'transcode'
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'libx265')
  assert.ok(avcCommand.safePreview.includes('rtsp://admin:***@example.com/live'))
})
