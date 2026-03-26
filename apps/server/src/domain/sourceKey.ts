import { sha256 } from "@rtsp-gateway/shared";
import type { NormalizedStreamCreateRequest } from "../types.js";

export function buildSourceKey(req: NormalizedStreamCreateRequest): string {
  return sha256(
    JSON.stringify({
      url: req.url,
      transport: req.transport,
      ioTimeoutUs: req.ioTimeoutUs,
      video: req.video,
      audio: req.audio
    })
  );
}

