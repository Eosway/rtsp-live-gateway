export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, detail?: Record<string, unknown>): void
  info(message: string, detail?: Record<string, unknown>): void
  warn(message: string, detail?: Record<string, unknown>): void
  error(message: string, detail?: Record<string, unknown>): void
}

function write(level: LogLevel, message: string, detail?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(detail ? { detail } : {}),
  }
  // 结构化日志，便于后续接入采集。
  process.stdout.write(`${JSON.stringify(payload)}\n`)
}

export function createConsoleLogger(): Logger {
  return {
    debug: (message, detail) => write('debug', message, detail),
    info: (message, detail) => write('info', message, detail),
    warn: (message, detail) => write('warn', message, detail),
    error: (message, detail) => write('error', message, detail),
  }
}
