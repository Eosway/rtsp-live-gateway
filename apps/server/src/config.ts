import { createConsoleLogger, type Logger } from "@rtsp-gateway/shared";

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  logLevel: "debug" | "info" | "warn" | "error";
  startupTimeoutMs: number;
  idleGraceMs: number;
  stopGraceMs: number;
  maxQueueBytes: number;
  maxSources: number;
  maxViewersPerSource: number;
  ssrfAllowPrivateIp: boolean;
  rtspHostAllowlist: string[];
  corsAllowOrigin: string;
  logger: Logger;
}

function parseIntValue(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolValue(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  return value.toLowerCase() === "true";
}

export function loadServerConfig(): ServerConfig {
  const logLevel =
    (process.env.LOG_LEVEL as ServerConfig["logLevel"] | undefined) ?? "info";

  return {
    port: parseIntValue(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV ?? "development",
    logLevel,
    startupTimeoutMs: parseIntValue(process.env.STREAM_STARTUP_TIMEOUT_MS, 8000),
    idleGraceMs: parseIntValue(process.env.STREAM_IDLE_GRACE_MS, 15000),
    stopGraceMs: parseIntValue(process.env.STOP_GRACE_MS, 1500),
    maxQueueBytes: parseIntValue(process.env.MAX_QUEUE_BYTES, 2 * 1024 * 1024),
    maxSources: parseIntValue(process.env.MAX_SOURCES, 64),
    maxViewersPerSource: parseIntValue(process.env.MAX_VIEWERS_PER_SOURCE, 256),
    ssrfAllowPrivateIp: parseBoolValue(process.env.SSRF_ALLOW_PRIVATE_IP, false),
    rtspHostAllowlist: (process.env.RTSP_HOST_ALLOWLIST ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    corsAllowOrigin: process.env.CORS_ALLOW_ORIGIN ?? "*",
    logger: createConsoleLogger()
  };
}

