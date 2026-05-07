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

test('auto mode should choose copy only for first attempt when probed codec matches', () => {
  assert.equal(resolveVideoPlan(1, 'auto', 'h264', 'h264'), 'copy')
  assert.equal(resolveVideoPlan(1, 'auto', 'h265', 'h265'), 'copy')
  assert.equal(resolveVideoPlan(1, 'auto', 'h264', 'h265'), 'transcode')
  assert.equal(resolveVideoPlan(1, 'auto', 'h264', 'unknown'), 'transcode')
  assert.equal(resolveVideoPlan(2, 'auto', 'h264', 'h264'), 'transcode')
})

test('transcode mode should never downgrade to copy even if input codec matches', () => {
  assert.equal(resolveVideoPlan(1, 'transcode', 'h264', 'h264'), 'transcode')
  assert.equal(resolveVideoPlan(1, 'transcode', 'h265', 'h265'), 'transcode')
})

test('copy mode should preserve video bitstream copy', () => {
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'copy',
    'h265'
  )

  const videoCodecIndex = command.args.indexOf('-c:v')
  assert.equal(command.args[videoCodecIndex + 1], 'copy')
})

test('transcode mode should map h264 or h265 to libx264 or libx265', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264')
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'transcode',
    'h265'
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'libx265')
  assert.equal(avcCommand.args[avcCommand.args.indexOf('-preset') + 1], 'veryfast')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-preset') + 1], 'veryfast')
  assert.ok(avcCommand.safePreview.includes('rtsp://admin:***@example.com/live'))
})

test('hardware encoder should map output codec to nvenc encoder', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264', {
    decoder: 'auto',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'transcode',
    'h265',
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
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264', {
    decoder: 'auto',
    encoder: 'software',
    hardwareVendor: 'nvidia',
  })
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'transcode',
    'h265',
    {
      decoder: 'auto',
      encoder: 'software',
      hardwareVendor: 'nvidia',
    }
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'libx265')
})

test('auto encoder should currently fall back to software templates', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264', {
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
  })
  const hevcCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'transcode',
    'h265',
    {
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  assert.equal(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1], 'libx264')
  assert.equal(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1], 'libx265')
})

test('template group should resolve by codec family first', () => {
  const avcHardwareCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264', {
    decoder: 'auto',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })
  const hevcSoftwareCommand = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'transcode',
    'h265',
    {
      decoder: 'auto',
      encoder: 'software',
      hardwareVendor: 'nvidia',
    }
  )

  assert.equal(avcHardwareCommand.args[avcHardwareCommand.args.indexOf('-c:v') + 1], 'h264_nvenc')
  assert.equal(hevcSoftwareCommand.args[hevcSoftwareCommand.args.indexOf('-c:v') + 1], 'libx265')
})

test('hardware decoder should inject cuda and cuvid args for h264 transcode', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264', {
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  assert.deepEqual(command.args.slice(0, 10), [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-hwaccel',
    'cuda',
    '-c:v',
    'h264_cuvid',
    '-rtsp_transport',
    'tcp',
    '-timeout',
  ])
})

test('hardware decoder should inject cuda and cuvid args for h265 transcode', () => {
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
      },
    }),
    'transcode',
    'h265',
    {
      decoder: 'hardware',
      encoder: 'hardware',
      hardwareVendor: 'nvidia',
    }
  )

  const decoderCodecIndex = command.args.indexOf('-c:v')
  assert.equal(command.args[decoderCodecIndex - 2], '-hwaccel')
  assert.equal(command.args[decoderCodecIndex - 1], 'cuda')
  assert.equal(command.args[decoderCodecIndex + 1], 'hevc_cuvid')
  assert.equal(command.args[command.args.lastIndexOf('-c:v') + 1], 'hevc_nvenc')
})

test('hardware decoder should not inject cuvid args for copy mode', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'copy', 'h264', {
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  assert.ok(!command.args.includes('h264_cuvid'))
  assert.ok(!command.args.includes('cuda'))
})

test('hardware decoder should not inject cuvid args when input codec is unknown', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'unknown', {
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  assert.ok(!command.args.includes('h264_cuvid'))
  assert.ok(!command.args.includes('hevc_cuvid'))
  assert.ok(!command.args.includes('cuda'))
})
