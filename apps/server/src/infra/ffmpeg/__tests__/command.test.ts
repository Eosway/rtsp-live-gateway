import { expect, test } from 'vitest'
import { buildFfmpegCommand, resolveAudioPlan, resolveVideoPlan } from '../command.js'
import type { ResolvedAudioPlan, ResolvedStreamCreateRequest } from '../../../types.js'

function createRequest(overrides: Partial<ResolvedStreamCreateRequest> = {}): ResolvedStreamCreateRequest {
  return {
    url: 'rtsp://admin:secret@example.com/live',
    transport: 'tcp',
    video: {
      mode: 'auto',
      fallbackCodec: 'h264',
    },
    audio: {
      enabled: false,
    },
    ...overrides,
  }
}

test('auto mode should choose copy only for first attempt when probed codec matches', () => {
  expect(resolveVideoPlan(1, { mode: 'auto', codec: 'h264', fallbackCodec: 'h264' }, 'h264')).toBe('copy')
  expect(resolveVideoPlan(1, { mode: 'auto', codec: 'h265', fallbackCodec: 'h264' }, 'h265')).toBe('copy')
  expect(resolveVideoPlan(1, { mode: 'auto', codec: 'h264', fallbackCodec: 'h264' }, 'h265')).toBe('transcode')
  expect(resolveVideoPlan(1, { mode: 'auto', fallbackCodec: 'h264' }, 'h265')).toBe('copy')
  expect(resolveVideoPlan(1, { mode: 'auto', fallbackCodec: 'h264' }, 'unknown')).toBe('transcode')
  expect(resolveVideoPlan(2, { mode: 'auto', fallbackCodec: 'h264' }, 'h264')).toBe('transcode')
})

test('transcode mode should never downgrade to copy even if input codec matches', () => {
  expect(resolveVideoPlan(1, { mode: 'transcode', codec: 'h264' }, 'h264')).toBe('transcode')
  expect(resolveVideoPlan(1, { mode: 'transcode', codec: 'h265' }, 'h265')).toBe('transcode')
})

test('copy mode should preserve video bitstream copy', () => {
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      video: {
        mode: 'auto',
        codec: 'h265',
        fallbackCodec: 'h264',
      },
    }),
    'copy',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  const videoCodecIndex = command.args.indexOf('-c:v')
  expect(command.args[videoCodecIndex + 1]).toBe('copy')
})

test('audio disabled should emit -an', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
    decoder: 'auto',
    encoder: 'auto',
    hardwareVendor: 'nvidia',
  })

  expect(command.args).toContain('-an')
})

test('audio enabled should emit c:a copy', () => {
  const audioPlan: ResolvedAudioPlan = {
    enabled: true,
    mode: 'copy',
  }
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'aac',
      },
    }),
    'transcode',
    audioPlan,
    'h264',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  expect(command.args).toContain('-c:a')
  expect(command.args[command.args.indexOf('-c:a') + 1]).toBe('copy')
})

test('audio transcode should default to native aac encoder', () => {
  const audioPlan: ResolvedAudioPlan = {
    enabled: true,
    mode: 'transcode',
    codec: 'aac',
  }
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'aac',
      },
    }),
    'transcode',
    audioPlan,
    'h264',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  expect(command.args).toContain('-c:a')
  expect(command.args[command.args.indexOf('-c:a') + 1]).toBe('aac')
})

test('audio transcode should map mp3 to libmp3lame', () => {
  const audioPlan: ResolvedAudioPlan = {
    enabled: true,
    mode: 'transcode',
    codec: 'mp3',
  }
  const command = buildFfmpegCommand(
    '/usr/bin/ffmpeg',
    createRequest({
      audio: {
        enabled: true,
        mode: 'transcode',
        codec: 'mp3',
      },
    }),
    'transcode',
    audioPlan,
    'h264',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  expect(command.args).toContain('-c:a')
  expect(command.args[command.args.indexOf('-c:a') + 1]).toBe('libmp3lame')
})

test('audio auto should choose copy for aac input', () => {
  const plan = resolveAudioPlan(
    createRequest({
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'aac',
      },
    }),
    'aac'
  )

  expect(plan).toEqual({
    enabled: true,
    mode: 'copy',
  })
})

test('audio auto should choose copy for mp3 input', () => {
  const plan = resolveAudioPlan(
    createRequest({
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'aac',
      },
    }),
    'mp3'
  )

  expect(plan).toEqual({
    enabled: true,
    mode: 'copy',
  })
})

test('audio auto should transcode unknown input to requested codec', () => {
  const plan = resolveAudioPlan(
    createRequest({
      audio: {
        enabled: true,
        mode: 'auto',
        codec: 'mp3',
      },
    }),
    'unknown'
  )

  expect(plan).toEqual({
    enabled: true,
    mode: 'transcode',
    codec: 'mp3',
  })
})

test('transcode mode should map h264 or h265 to libx264 or libx265', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
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
        fallbackCodec: 'h264',
      },
    }),
    'transcode',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('libx264')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
  expect(avcCommand.args[avcCommand.args.indexOf('-preset') + 1]).toBe('veryfast')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-preset') + 1]).toBe('veryfast')
  expect(avcCommand.safePreview).toContain('rtsp://admin:***@example.com/live')
})

test('hardware encoder should map output codec to nvenc encoder', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
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
        fallbackCodec: 'h264',
      },
    }),
    'transcode',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'hardware',
      hardwareVendor: 'nvidia',
    }
  )

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('h264_nvenc')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('hevc_nvenc')
})

test('software encoder should map h264 or h265 to libx264 or libx265', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
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
        fallbackCodec: 'h264',
      },
    }),
    'transcode',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'software',
      hardwareVendor: 'nvidia',
    }
  )

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('libx264')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
})

test('auto encoder should currently fall back to software templates', () => {
  const avcCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
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
        fallbackCodec: 'h264',
      },
    }),
    'transcode',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'auto',
      hardwareVendor: 'nvidia',
    }
  )

  expect(avcCommand.args[avcCommand.args.indexOf('-c:v') + 1]).toBe('libx264')
  expect(hevcCommand.args[hevcCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
})

test('template group should resolve by codec family first', () => {
  const avcHardwareCommand = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
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
        fallbackCodec: 'h264',
      },
    }),
    'transcode',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
      decoder: 'auto',
      encoder: 'software',
      hardwareVendor: 'nvidia',
    }
  )

  expect(avcHardwareCommand.args[avcHardwareCommand.args.indexOf('-c:v') + 1]).toBe('h264_nvenc')
  expect(hevcSoftwareCommand.args[hevcSoftwareCommand.args.indexOf('-c:v') + 1]).toBe('libx265')
})

test('hardware decoder should inject cuda and cuvid args for h264 transcode', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
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
        fallbackCodec: 'h264',
      },
    }),
    'transcode',
    { enabled: false },
    'h265',
    {
      ioTimeoutMs: 5000,
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
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'copy', { enabled: false }, 'h264', {
    ioTimeoutMs: 5000,
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  expect(command.args).not.toContain('h264_cuvid')
  expect(command.args).not.toContain('cuda')
})

test('hardware decoder should not inject cuvid args when input codec is unknown', () => {
  const command = buildFfmpegCommand('/usr/bin/ffmpeg', createRequest(), 'transcode', { enabled: false }, 'unknown', {
    ioTimeoutMs: 5000,
    decoder: 'hardware',
    encoder: 'hardware',
    hardwareVendor: 'nvidia',
  })

  expect(command.args).not.toContain('h264_cuvid')
  expect(command.args).not.toContain('hevc_cuvid')
  expect(command.args).not.toContain('cuda')
})
