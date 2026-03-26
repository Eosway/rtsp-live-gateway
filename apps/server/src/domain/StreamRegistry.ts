import type { StreamStatusResponse } from "@rtsp-gateway/protocol";
import { randomUUID } from "node:crypto";
import type { ServerConfig } from "../config.js";
import { ApiError } from "../errors.js";
import type { NormalizedStreamCreateRequest } from "../types.js";
import { buildSourceKey } from "./sourceKey.js";
import { StreamSource } from "./StreamSource.js";

interface StreamRegistryOptions {
  config: ServerConfig;
  ffmpegPath: string;
}

export class StreamRegistry {
  private readonly byStreamId = new Map<string, StreamSource>();
  private readonly bySourceKey = new Map<string, StreamSource>();
  private readonly config: ServerConfig;
  private readonly ffmpegPath: string;

  constructor(options: StreamRegistryOptions) {
    this.config = options.config;
    this.ffmpegPath = options.ffmpegPath;
  }

  createOrReuse(req: NormalizedStreamCreateRequest): {
    source: StreamSource;
    reused: boolean;
  } {
    const sourceKey = buildSourceKey(req);
    const existing = this.bySourceKey.get(sourceKey);
    if (existing) {
      return { source: existing, reused: true };
    }

    if (this.bySourceKey.size >= this.config.maxSources) {
      throw new ApiError(
        "INVALID_ARGUMENT",
        "Source limit reached",
        { maxSources: this.config.maxSources },
        429
      );
    }

    const streamId = `st_${randomUUID().replace(/-/g, "")}`;
    const source = new StreamSource({
      streamId,
      sourceKey,
      req,
      ffmpegPath: this.ffmpegPath,
      startupTimeoutMs: this.config.startupTimeoutMs,
      idleGraceMs: this.config.idleGraceMs,
      stopGraceMs: this.config.stopGraceMs,
      maxStartAttempts: 2,
      logger: this.config.logger
    });
    this.bySourceKey.set(sourceKey, source);
    this.byStreamId.set(streamId, source);
    return { source, reused: false };
  }

  get(streamId: string): StreamSource | undefined {
    return this.byStreamId.get(streamId);
  }

  list(): StreamStatusResponse[] {
    return [...this.byStreamId.values()].map((source) => source.snapshotStatus());
  }

  async remove(streamId: string): Promise<void> {
    const source = this.byStreamId.get(streamId);
    if (!source) {
      throw new ApiError("STREAM_NOT_FOUND", "Stream not found");
    }
    await source.stop("deleted");
    this.byStreamId.delete(streamId);
    this.bySourceKey.delete(source.sourceKey);
  }

  snapshotMetrics(): {
    sources: number;
    runningSources: number;
    viewers: number;
    bytesOut: number;
  } {
    const statuses = this.list();
    return {
      sources: statuses.length,
      runningSources: statuses.filter((item) => item.state === "running").length,
      viewers: statuses.reduce((acc, item) => acc + item.viewerCount, 0),
      bytesOut: statuses.reduce((acc, item) => acc + item.stats.bytesOut, 0)
    };
  }
}

