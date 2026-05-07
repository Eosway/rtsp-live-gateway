import { expect, test } from 'vitest'
import { buildFfmpegCommand, resolveVideoPlan } from '../FFmpegCommandBuilder.js'
import type { NormalizedStreamCreateRequest } from '../../../types.js'

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
  expect(resolveVideoPlan(1, 'auto', 'h264', 'h264')).toBe('copy')
  expect(resolveVideoPlan(1, 'auto', 'h265', 'h265')).toBe('copy')
  expect(resolveVideoPlan(1, 'auto', 'h264', 'h265')).toBe('transcode')
  expect(resolveVideoPlan(1, 'auto', 'h264', 'unknown')).toBe('transcode')
  expect(resolveVideoPlan(2, 'auto', 'h264', 'h264')).toBe('transcode')
})

test('transcode mode should never downgrade to copy even if input codec matches', () => {
  expect(resolveVideoPlan(1, 'transcode', 'h264', 'h264')).toBe('transcode')
  expect(resolveVideoPlan(1, 'transcode', 'h265', 'h265')).toBe('transcode')
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
  expect(command.args[videoCodecIndex + 1]).toBe('copy')
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

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('libx264')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
  expect(avcCommand.args[avcCommand.args.indexOf('-preset') + 1]).toBe('veryfast')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-preset') + 1]).toBe('veryfast')
  expect(avcCommand.safePreview).toContain('rtsp://admin:***@example.com/live')
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

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('h264_nvenc')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('hevc_nvenc')
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

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('libx264')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
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

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('libx264')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
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

  expect(avcHardwareCommand.args[avcHardwareCommand.args.indexOf('-c:v') + 1]).toBe('h264_nvenc')
  expect(hevcSoftwareCommand.args[hevcSoftwareCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
})

test('hardware decoder should inject cuda and cuvid args for h264 transcode', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'h264', {
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  expect(command.args.slice(0, 10)).toEqual([
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
  expect(command.args[decoderCodecIndex - 2]).toBe('-hwaccel')
  expect(command.args[decoderCodecIndex - 1]).toBe('cuda')
  expect(command.args[decoderCodecIndex + 1]).toBe('hevc_cuvid')
  expect(command.args[command.args.lastIndexOf('-c:v') + 1]).toBe('hevc_nvenc')
})

test('hardware decoder should not inject cuvid args for copy mode', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'copy', 'h264', {
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  expect(command.args).not.toContain('h264_cuvid')
  expect(command.args).not.toContain('cuda')
})

test('hardware decoder should not inject cuvid args when input codec is unknown', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', 'unknown', {
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  expect(command.args).not.toContain('h264_cuvid')
  expect(command.args).not.toContain('hevc_cuvid')
  expect(command.args).not.toContain('cuda')
})
