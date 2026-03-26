import type {
  ApiErrorBody,
  StreamCreateRequest,
  StreamCreateResponse,
  StreamStatusResponse
} from "@rtsp-gateway/protocol";

class SdkError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: Record<string, unknown>;

  constructor(message: string, options: { status: number; code?: string; detail?: Record<string, unknown> }) {
    super(message);
    this.status = options.status;
    this.code = options.code;
    this.detail = options.detail;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

async function parseJsonSafe<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await parseJsonSafe<ApiErrorBody>(response);
    throw new SdkError(body?.message ?? `HTTP ${response.status}`, {
      status: response.status,
      code: body?.code,
      detail: body?.detail
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const parsed = await parseJsonSafe<T>(response);
  if (parsed === undefined) {
    throw new SdkError("Invalid JSON response", { status: response.status });
  }
  return parsed;
}

export async function createStream(
  baseUrl: string,
  req: StreamCreateRequest
): Promise<StreamCreateResponse> {
  return request<StreamCreateResponse>(baseUrl, "/v1/streams", {
    method: "POST",
    body: JSON.stringify(req)
  });
}

export async function getStream(baseUrl: string, streamId: string): Promise<StreamStatusResponse> {
  return request<StreamStatusResponse>(baseUrl, `/v1/streams/${encodeURIComponent(streamId)}`);
}

export async function listStreams(baseUrl: string): Promise<StreamStatusResponse[]> {
  return request<StreamStatusResponse[]>(baseUrl, "/v1/streams");
}

export async function deleteStream(baseUrl: string, streamId: string): Promise<void> {
  await request<void>(baseUrl, `/v1/streams/${encodeURIComponent(streamId)}`, {
    method: "DELETE"
  });
}

export function buildLiveUrl(baseUrl: string, streamId: string): string {
  return `${normalizeBaseUrl(baseUrl)}/v1/live/${encodeURIComponent(streamId)}.flv`;
}

export { SdkError };
