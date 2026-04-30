import type {
  ApiErrorBody,
  ApiErrorCode,
  ApiErrorDetail,
  HealthzResponse,
  StreamCreateRequest,
  StreamCreateResponse,
  StreamDeleteResponse,
  StreamListResponse,
  StreamStatusResponse,
} from '@eosway/rtsp-live-gateway-protocol'
class ClientError extends Error {
  readonly status: number
  readonly code?: ApiErrorCode
  readonly requestId?: string
  readonly detail?: ApiErrorDetail

  constructor(message: string, options: { status: number; code?: ApiErrorCode; requestId?: string; detail?: ApiErrorDetail }) {
    super(message)
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
    this.detail = options.detail
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

async function parseJsonSafe<T>(response: Response): Promise<T | undefined> {
  const text = await response.text()
  if (!text) {
    return undefined
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const body = await parseJsonSafe<ApiErrorBody>(response)
    throw new ClientError(body?.message ?? `HTTP ${response.status}`, {
      status: response.status,
      code: body?.code,
      requestId: body?.requestId,
      detail: body?.detail,
    })
  }

  if (response.status === 204) {
    return undefined as T
  }

  const parsed = await parseJsonSafe<T>(response)
  if (parsed === undefined) {
    throw new ClientError('Invalid JSON response', { status: response.status })
  }
  return parsed
}

export async function createStream(baseUrl: string, req: StreamCreateRequest): Promise<StreamCreateResponse> {
  return request<StreamCreateResponse>(baseUrl, '/v1/streams', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function getStream(baseUrl: string, streamId: string): Promise<StreamStatusResponse> {
  return request<StreamStatusResponse>(baseUrl, `/v1/streams/${encodeURIComponent(streamId)}`)
}

export async function getHealthz(baseUrl: string): Promise<HealthzResponse> {
  return request<HealthzResponse>(baseUrl, '/v1/healthz')
}

export async function listStreams(baseUrl: string): Promise<StreamListResponse> {
  return request<StreamListResponse>(baseUrl, '/v1/streams')
}

export async function deleteStream(baseUrl: string, streamId: string): Promise<StreamDeleteResponse> {
  await request<StreamDeleteResponse>(baseUrl, `/v1/streams/${encodeURIComponent(streamId)}`, {
    method: 'DELETE',
  })
}

export function buildLiveUrl(baseUrl: string, streamId: string): string {
  return `${normalizeBaseUrl(baseUrl)}/v1/live/${encodeURIComponent(streamId)}`
}

export { ClientError }
export type {
  ApiErrorBody,
  ApiErrorCode,
  ApiErrorDetail,
  HealthzResponse,
  StreamCreateRequest,
  StreamCreateResponse,
  StreamDeleteResponse,
  StreamListResponse,
  StreamStatusResponse,
} from '@eosway/rtsp-live-gateway-protocol'
