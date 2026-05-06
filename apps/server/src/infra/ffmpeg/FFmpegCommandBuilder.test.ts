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
      codec: 'h264',
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

test('auto mode should always transcode to honor requested output codec', () => {
  assert.equal(resolveVideoPlan(1, 'h264', 'h264'), 'copy')
  assert.equal(resolveVideoPlan(1, 'h265', 'h265'), 'copy')
  assert.equal(resolveVideoPlan(1, 'h264', 'h265'), 'transcode')
  assert.equal(resolveVideoPlan(1, 'h264', 'unknown'), 'transcode')
  assert.equal(resolveVideoPlan(2, 'h264', 'h264'), 'transcode')
})

test('copy mode should preserve video bitstream copy', () => {
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        codec: 'h265',
      },
    }),
    'copy'
  )

  const videoCodecIndex = command.args.indexOf('-c:v')
  assert.equal(command.args[videoCodecIndex + 1], 'copy')
})

test('transcode mode should map h264 or h265 to libx264 or libx265', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode')
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        codec: 'h265',
      },
    }),
    'transcode'
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'libx265')
  assert.equal(avcCommand.args[avcCommand.args.indexOf('-preset') + 1], 'veryfast')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-preset') + 1], 'veryfast')
  assert.ok(avcCommand.safePreview.includes('rtsp://admin:***@example.com/live'))
})

test('hardware encoder should map output codec to nvenc encoder', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', {
    decoder: 'auto',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        codec: 'h265',
      },
    }),
    'transcode',
    {
      decoder: 'auto',
      encoder: 'hardware',
      hardwareVendor: 'nvidia',
    }
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'h264_nvenc')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'hevc_nvenc')
})

test('software encoder should map h264 or h265 to libx264 or libx265', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', {
    decoder: 'auto',
    encoder: 'software',
    hardwareVendor: 'nvidia',
  })
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        codec: 'h265',
      },
    }),
    'transcode',
    {
      decoder: 'auto',
      encoder: 'software',
      hardwareVendor: 'nvidia',
    }
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'libx265')
})

test('template group should resolve by codec family first', () => {
  const avcHardwareCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', {
    decoder: 'auto',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })
  const hevcSoftwareCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        codec: 'h265',
      },
    }),
    'transcode',
    {
      decoder: 'auto',
      encoder: 'software',
      hardwareVendor: 'nvidia',
    }
  )

  assert.equal(avcHardwareCommand.args[avcHardwareCommand.args.indexOf('-c:v') + 1], 'h264_nvenc')
  assert.equal(hevcSoftwareCommand.args[hevcSoftwareCommand.args.indexOf('-c:v') + 1], 'libx265')
})
