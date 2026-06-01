import { afterEach, expect, test } from 'vitest'
import { loadServerConfig } from '../config.js'

const originalEnv = {
  FFMPEG_DECODER: process.env.FFMPEG_DECODER,
  FFMPEG_ENCODER: process.env.FFMPEG_ENCODER,
  FFMPEG_HARDWARE_TEMPLATE: process.env.FFMPEG_HARDWARE_TEMPLATE,
  ENABLE_HTTPS: process.env.ENABLE_HTTPS,
  TLS_CERT_PATH: process.env.TLS_CERT_PATH,
  TLS_KEY_PATH: process.env.TLS_KEY_PATH,
  HTTP2_ALLOW_HTTP1: process.env.HTTP2_ALLOW_HTTP1,
}

function restoreEnv(name: keyof typeof originalEnv, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv) as Array<[keyof typeof originalEnv, string | undefined]>) {
    restoreEnv(name, value)
  }
})

test('should load ffmpeg strategy defaults', () => {
  delete process.env.FFMPEG_DECODER
  delete process.env.FFMPEG_ENCODER
  delete process.env.FFMPEG_HARDWARE_TEMPLATE
  delete process.env.ENABLE_HTTPS
  delete process.env.TLS_CERT_PATH
  delete process.env.TLS_KEY_PATH
  delete process.env.HTTP2_ALLOW_HTTP1

  const config = loadServerConfig()
  expect(config.decoder).toBe('auto')
  expect(config.encoder).toBe('auto')
  expect(config.hardwareVendor).toBe('nvidia')
  expect(config.httpsEnabled).toBe(false)
  expect(config.http2AllowHttp1).toBe(true)
})

test('should load explicit ffmpeg strategy overrides', () => {
  process.env.FFMPEG_DECODER = 'software'
  process.env.FFMPEG_ENCODER = 'hardware'
  process.env.FFMPEG_HARDWARE_TEMPLATE = 'nvidia'

  const config = loadServerConfig()
  expect(config.decoder).toBe('software')
  expect(config.encoder).toBe('hardware')
  expect(config.hardwareVendor).toBe('nvidia')
})

test('should load https transport config', () => {
  process.env.ENABLE_HTTPS = 'true'
  process.env.TLS_CERT_PATH = '/certs/tls.crt'
  process.env.TLS_KEY_PATH = '/certs/tls.key'

  const config = loadServerConfig()

  expect(config.httpsEnabled).toBe(true)
  expect(config.tlsCertPath).toBe('/certs/tls.crt')
  expect(config.tlsKeyPath).toBe('/certs/tls.key')
})

test('should parse http2 allowHTTP1 override when https is enabled', () => {
  process.env.ENABLE_HTTPS = 'true'
  process.env.TLS_CERT_PATH = '/certs/tls.crt'
  process.env.TLS_KEY_PATH = '/certs/tls.key'
  process.env.HTTP2_ALLOW_HTTP1 = 'false'

  const config = loadServerConfig()

  expect(config.httpsEnabled).toBe(true)
  expect(config.http2AllowHttp1).toBe(false)
})

test('should require cert and key when tls is enabled', () => {
  process.env.ENABLE_HTTPS = 'true'
  delete process.env.TLS_CERT_PATH
  delete process.env.TLS_KEY_PATH

  expect(() => loadServerConfig()).toThrow('TLS_CERT_PATH is required when ENABLE_HTTPS=true')
})
