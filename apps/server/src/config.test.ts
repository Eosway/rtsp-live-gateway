import assert from 'node:assert/strict'
import test from 'node:test'
import { loadServerConfig } from './config.js'

test('should load ffmpeg strategy defaults', () => {
  const originalDecoder = process.env.FFMPEG_DECODER
  const originalEncoder = process.env.FFMPEG_ENCODER
  const originalTemplate = process.env.FFMPEG_HARDWARE_TEMPLATE
  delete process.env.FFMPEG_DECODER
  delete process.env.FFMPEG_ENCODER
  delete process.env.FFMPEG_HARDWARE_TEMPLATE

  const config = loadServerConfig()
  assert.equal(config.decoder, 'auto')
  assert.equal(config.encoder, 'auto')
  assert.equal(config.hardwareTemplate, 'nvidia')

  process.env.FFMPEG_DECODER = originalDecoder
  process.env.FFMPEG_ENCODER = originalEncoder
  process.env.FFMPEG_HARDWARE_TEMPLATE = originalTemplate
})

test('should load explicit ffmpeg strategy overrides', () => {
  const originalDecoder = process.env.FFMPEG_DECODER
  const originalEncoder = process.env.FFMPEG_ENCODER
  const originalTemplate = process.env.FFMPEG_HARDWARE_TEMPLATE
  process.env.FFMPEG_DECODER = 'software'
  process.env.FFMPEG_ENCODER = 'hardware'
  process.env.FFMPEG_HARDWARE_TEMPLATE = 'nvidia'

  const config = loadServerConfig()
  assert.equal(config.decoder, 'software')
  assert.equal(config.encoder, 'hardware')
  assert.equal(config.hardwareTemplate, 'nvidia')

  process.env.FFMPEG_DECODER = originalDecoder
  process.env.FFMPEG_ENCODER = originalEncoder
  process.env.FFMPEG_HARDWARE_TEMPLATE = originalTemplate
})
