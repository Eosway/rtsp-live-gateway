import { createConsoleLogger, type Logger } from './util/logger.js'

export interface ServerConfig {
  port: number
  httpsEnabled: boolean
  tlsCertPath?: string
  tlsKeyPath?: string
  http2AllowHttp1: boolean
  nodeEnv: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  ioTimeoutMs: number
  decoder: 'auto' | 'software' | 'hardware'
  encoder: 'auto' | 'software' | 'hardware'
  hardwareVendor: 'nvidia'
  startupTimeoutMs: number
  idleGraceMs: number
  stopGraceMs: number
  maxQueueBytes: number
  maxSources: number
  maxViewersPerSource: number
  ssrfAllowPrivateIp: boolean
  rtspHostAllowlist: string[]
  rtspHostDenylist: string[]
  rtspPortAllowlist: number[]
  corsAllowOrigin: string
  logger: Logger
}

function parseIntValue(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolValue(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }
  return value.toLowerCase() === 'true'
}

function parseNumberList(value: string | undefined, fallback: number[]): number[] {
  if (!value) {
    return fallback
  }
  const parsed = value
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0 && entry <= 65535)
  return parsed.length > 0 ? parsed : fallback
}

function parseStringList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseStrategy(value: string | undefined, fallback: ServerConfig['decoder']): ServerConfig['decoder'] {
  if (!value) {
    return fallback
  }
  if (value === 'auto' || value === 'software' || value === 'hardware') {
    return value
  }
  return fallback
}

function parseHardwareVendor(value: string | undefined): ServerConfig['hardwareVendor'] {
  if (value === 'nvidia') {
    return 'nvidia'
  }
  return 'nvidia'
}

function validateTlsConfig(config: Pick<ServerConfig, 'httpsEnabled' | 'tlsCertPath' | 'tlsKeyPath'>): void {
  if (!config.httpsEnabled) {
    return
  }
  if (!config.tlsCertPath) {
    throw new Error('TLS_CERT_PATH is required when ENABLE_HTTPS=true')
  }
  if (!config.tlsKeyPath) {
    throw new Error('TLS_KEY_PATH is required when ENABLE_HTTPS=true')
  }
}

export function loadServerConfig(): ServerConfig {
  const logLevel = (process.env.LOG_LEVEL as ServerConfig['logLevel'] | undefined) ?? 'info'
  const config: ServerConfig = {
    port: parseIntValue(process.env.PORT, 3000),
    httpsEnabled: parseBoolValue(process.env.ENABLE_HTTPS, false),
    tlsCertPath: process.env.TLS_CERT_PATH,
    tlsKeyPath: process.env.TLS_KEY_PATH,
    http2AllowHttp1: parseBoolValue(process.env.HTTP2_ALLOW_HTTP1, true),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    logLevel,
    ioTimeoutMs: parseIntValue(process.env.RTSP_IO_TIMEOUT_MS, 5000),
    decoder: parseStrategy(process.env.FFMPEG_DECODER, 'auto'),
    encoder: parseStrategy(process.env.FFMPEG_ENCODER, 'auto'),
    hardwareVendor: parseHardwareVendor(process.env.FFMPEG_HARDWARE_TEMPLATE),
    startupTimeoutMs: parseIntValue(process.env.STREAM_STARTUP_TIMEOUT_MS, 8000),
    idleGraceMs: parseIntValue(process.env.STREAM_IDLE_GRACE_MS, 15000),
    stopGraceMs: parseIntValue(process.env.STOP_GRACE_MS, 1500),
    maxQueueBytes: parseIntValue(process.env.MAX_QUEUE_BYTES, 2 * 1024 * 1024),
    maxSources: parseIntValue(process.env.MAX_SOURCES, 64),
    maxViewersPerSource: parseIntValue(process.env.MAX_VIEWERS_PER_SOURCE, 256),
    ssrfAllowPrivateIp: parseBoolValue(process.env.SSRF_ALLOW_PRIVATE_IP, false),
    rtspHostAllowlist: parseStringList(process.env.RTSP_HOST_ALLOWLIST),
    rtspHostDenylist: parseStringList(process.env.RTSP_HOST_DENYLIST),
    rtspPortAllowlist: parseNumberList(process.env.RTSP_PORT_ALLOWLIST, [554, 8554]),
    corsAllowOrigin: process.env.CORS_ALLOW_ORIGIN ?? '*',
    logger: createConsoleLogger(),
  }

  validateTlsConfig(config)

  return config
}
