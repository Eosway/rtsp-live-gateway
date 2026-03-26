import type { StreamCreateRequest } from "@rtsp-gateway/protocol";
import { createStream, deleteStream } from "@rtsp-gateway/sdk";

export async function ensureStreamId(options: {
  baseUrl: string;
  mode: "streamId" | "create";
  streamId?: string;
  createRequest?: StreamCreateRequest;
}): Promise<{ streamId: string; createdByComponent: boolean }> {
  if (options.mode === "streamId") {
    if (!options.streamId) {
      throw new Error("streamId is required in streamId mode");
    }
    return {
      streamId: options.streamId,
      createdByComponent: false
    };
  }

  if (!options.createRequest) {
    throw new Error("createRequest is required in create mode");
  }
  const response = await createStream(options.baseUrl, options.createRequest);
  return {
    streamId: response.streamId,
    createdByComponent: true
  };
}

export async function cleanupStream(
  baseUrl: string,
  streamId: string,
  enabled: boolean
): Promise<void> {
  if (!enabled) {
    return;
  }
  try {
    await deleteStream(baseUrl, streamId);
  } catch {
    // 卸载清理失败时不抛出，避免影响页面生命周期。
  }
}

