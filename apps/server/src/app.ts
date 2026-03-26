import type {
  StreamCreateResponse,
  StreamStatusResponse
} from "@rtsp-gateway/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { randomUUID } from "node:crypto";
import type { ServerConfig } from "./config.js";
import { normalizeCreateRequest } from "./domain/normalize.js";
import { PlaybackSession } from "./domain/PlaybackSession.js";
import { StreamRegistry } from "./domain/StreamRegistry.js";
import { ApiError, toApiError } from "./errors.js";
import { assertRtspTargetAllowed } from "./security/ssrf.js";

interface CreateAppOptions {
  config: ServerConfig;
  ffmpegPath: string;
}

function buildPlayUrl(requestUrl: string, streamId: string): string {
  const url = new URL(requestUrl);
  url.pathname = `/v1/live/${streamId}.flv`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildMetricsText(metrics: {
  sources: number;
  runningSources: number;
  viewers: number;
  bytesOut: number;
}): string {
  return [
    "# HELP rtsp_gw_sources Number of current stream sources.",
    "# TYPE rtsp_gw_sources gauge",
    `rtsp_gw_sources ${metrics.sources}`,
    "# HELP rtsp_gw_running_sources Number of currently running stream sources.",
    "# TYPE rtsp_gw_running_sources gauge",
    `rtsp_gw_running_sources ${metrics.runningSources}`,
    "# HELP rtsp_gw_viewers Number of active playback sessions.",
    "# TYPE rtsp_gw_viewers gauge",
    `rtsp_gw_viewers ${metrics.viewers}`,
    "# HELP rtsp_gw_bytes_out_total Total fanout bytes output.",
    "# TYPE rtsp_gw_bytes_out_total counter",
    `rtsp_gw_bytes_out_total ${metrics.bytesOut}`
  ].join("\n");
}

export function createApp(options: CreateAppOptions) {
  const app = new Hono<{ Variables: { requestId: string } }>();
  const registry = new StreamRegistry({
    config: options.config,
    ffmpegPath: options.ffmpegPath
  });

  app.use(
    "*",
    cors({
      origin: options.config.corsAllowOrigin
    })
  );

  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
  });

  app.onError((error, c) => {
    const apiError = toApiError(error);
    const requestId = c.get("requestId") as string | undefined;
    return c.json(apiError.toBody(requestId), apiError.status as 500);
  });

  app.get("/v1/healthz", (c) => {
    return c.json({
      status: "ok",
      ffmpegPath: options.ffmpegPath,
      uptimeSec: Math.floor(process.uptime())
    });
  });

  app.get("/v1/metrics", (c) => {
    c.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return c.body(`${buildMetricsText(registry.snapshotMetrics())}\n`);
  });

  app.post("/v1/streams", async (c) => {
    const body = await c.req.json().catch(() => {
      throw new ApiError("INVALID_ARGUMENT", "Invalid JSON payload");
    });
    const req = normalizeCreateRequest(body);
    await assertRtspTargetAllowed(req.url, {
      allowPrivateIp: options.config.ssrfAllowPrivateIp,
      allowlist: options.config.rtspHostAllowlist,
      denylist: options.config.rtspHostDenylist,
      portAllowlist: options.config.rtspPortAllowlist,
      requestAllowPrivateIp: req.allowPrivateIp
    });

    const { source, reused } = registry.createOrReuse(req);
    const response: StreamCreateResponse = {
      streamId: source.streamId,
      state: source.getState(),
      playUrl: buildPlayUrl(c.req.url, source.streamId),
      reused,
      createdAt: source.createdAt
    };
    return c.json(response);
  });

  app.get("/v1/streams", (c) => c.json(registry.list()));

  app.get("/v1/streams/:streamId", (c) => {
    const streamId = c.req.param("streamId");
    if (!streamId) {
      throw new ApiError("INVALID_ARGUMENT", "streamId is required");
    }
    const source = registry.get(streamId);
    if (!source) {
      throw new ApiError("STREAM_NOT_FOUND", "Stream not found");
    }
    const response: StreamStatusResponse = source.snapshotStatus();
    return c.json(response);
  });

  app.delete("/v1/streams/:streamId", async (c) => {
    const streamId = c.req.param("streamId");
    if (!streamId) {
      throw new ApiError("INVALID_ARGUMENT", "streamId is required");
    }
    await registry.remove(streamId);
    return c.body(null, 204);
  });

  app.get("/v1/live/:streamId.flv", async (c) => {
    const streamId = c.req.param("streamId");
    if (!streamId) {
      throw new ApiError("INVALID_ARGUMENT", "streamId is required");
    }
    const source = registry.get(streamId);
    if (!source) {
      throw new ApiError("STREAM_NOT_FOUND", "Stream not found");
    }

    if (source.viewerCount() >= options.config.maxViewersPerSource) {
      throw new ApiError(
        "INVALID_ARGUMENT",
        "Viewer limit reached",
        { maxViewersPerSource: options.config.maxViewersPerSource },
        429
      );
    }

    const session = new PlaybackSession({
      streamId,
      remoteIp: c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
      maxQueueBytes: options.config.maxQueueBytes
    });
    source.addViewer(session);

    try {
      await source.ensureStarted("first_viewer");
    } catch (error) {
      source.removeViewer(session.sessionId, "startup_failed");
      throw error;
    }

    c.header("content-type", "video/x-flv");
    c.header("cache-control", "no-store, no-cache, must-revalidate");
    c.header("x-content-type-options", "nosniff");

    return stream(c, async (output) => {
      output.onAbort(() => {
        source.removeViewer(session.sessionId, "client_abort");
      });

      try {
        await session.drain(async (chunk) => {
          await output.write(chunk);
        });
      } finally {
        source.removeViewer(session.sessionId, session.getCloseReason() ?? "stream_closed");
      }
    });
  });

  return app;
}
