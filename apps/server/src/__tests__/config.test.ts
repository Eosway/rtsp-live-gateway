import { afterEach, expect, test } from 'vitest'
import { loadServerConfig } from '../config.js'

const originalDecoder = process.env.FFMPEG_DECODER
const originalEncoder = process.env.FFMPEG_ENCODER
const originalTemplate = process.env.FFMPEG_HARDWARE_TEMPLATE

function restoreEnv(name: 'FFMPEG_DECODER' | 'FFMPEG_ENCODER' | 'FFMPEG_HARDWARE_TEMPLATE', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

afterEach(() => {
  restoreEnv('FFMPEG_DECODER', originalDecoder)
  restoreEnv('FFMPEG_ENCODER', originalEncoder)
  restoreEnv('FFMPEG_HARDWARE_TEMPLATE', originalTemplate)
})

test('should load ffmpeg strategy defaults', () => {
  delete process.env.FFMPEG_DECODER
  delete process.env.FFMPEG_ENCODER
  delete process.env.FFMPEG_HARDWARE_TEMPLATE

  const config = loadServerConfig()
  expect(config.decoder).toBe('auto')
  expect(config.encoder).toBe('auto')
  expect(config.hardwareTemplate).toBe('nvidia')
})

test('should load explicit ffmpeg strategy overrides', () => {
  process.env.FFMPEG_DECODER = 'software'
  process.env.FFMPEG_ENCODER = 'hardware'
  process.env.FFMPEG_HARDWARE_TEMPLATE = 'nvidia'

  const config = loadServerConfig()
  expect(config.decoder).toBe('software')
  expect(config.encoder).toBe('hardware')
  expect(config.hardwareTemplate).toBe('nvidia')
})
