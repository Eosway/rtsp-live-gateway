import { maskRtspUrl } from "@rtsp-gateway/shared";
import type { NormalizedStreamCreateRequest } from "../../types.js";

export interface FFmpegCommand {
  cmd: string;
  args: string[];
  safePreview: string;
}

export function buildFfmpegCommand(
  ffmpegPath: string,
  req: NormalizedStreamCreateRequest
): FFmpegCommand {
  const connectTimeoutUs = req.connectTimeoutMs * 1000;
  const args: string[] = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-rw_timeout",
    String(connectTimeoutUs),
    "-rtsp_transport",
    req.transport,
    "-timeout",
    String(req.ioTimeoutUs),
    "-i",
    req.url
  ];

  if (!req.audio.enabled || req.audio.mode === "drop") {
    args.push("-an");
  } else if (req.audio.mode === "copy") {
    args.push("-c:a", "copy");
  } else {
    args.push("-c:a", req.audio.codec, "-b:a", `${req.audio.bitrateKbps}k`);
  }

  const videoMode = req.video.mode === "auto" ? "copy" : req.video.mode;
  if (videoMode === "copy") {
    args.push("-c:v", "copy");
  } else {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency");
    if (req.video.gop > 0) {
      args.push("-g", String(req.video.gop), "-keyint_min", String(req.video.gop));
    }
    if (req.video.fps > 0) {
      args.push("-r", String(req.video.fps));
    }
    if (req.video.bitrateKbps > 0) {
      args.push("-b:v", `${req.video.bitrateKbps}k`);
    }
    if (req.video.width > 0 && req.video.height > 0) {
      args.push("-vf", `scale=${req.video.width}:${req.video.height}`);
    }
  }

  args.push("-f", "flv", "-flvflags", "no_duration_filesize", "pipe:1");

  return {
    cmd: ffmpegPath,
    args,
    safePreview: [ffmpegPath, ...args.map((part) => maskRtspUrl(part))].join(" ")
  };
}
