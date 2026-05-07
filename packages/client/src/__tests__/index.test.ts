import { afterEach, expect, test, vi } from 'vitest'
import { ClientError, buildLiveUrl, createStream, deleteStream, getHealthz, getStream, listStreams } from '../index.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('buildLiveUrl should format expected flv endpoint', () => {
  const url = buildLiveUrl('http://localhost:3000/', 'st_demo')
  expect(url).toBe('http://localhost:3000/v1/live/st_demo')
})

test('createStream should POST and return parsed payload', async () => {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    expect(String(input)).toBe('http://localhost:3000/v1/streams')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
    return new Response(
      JSON.stringify({
        streamId: 'st_1',
        state: 'idle',
        reused: false,
        createdAt: '2026-03-26T00:00:00.000Z',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  })
  vi.stubGlobal('fetch', fetchMock)

  const result = await createStream('http://localhost:3000', {
    url: 'rtsp://example/live',
  })

  expect(result.streamId).toBe('st_1')
})

test('get/list/delete should hit expected paths', async () => {
  const calls: Array<{ input: string; method: string; contentType: string | null }> = []
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      input: String(input),
      method: init?.method ?? 'GET',
      contentType: new Headers(init?.headers).get('content-type'),
    })
    if (String(input).endsWith('/v1/streams/st_x')) {
      return new Response(
        JSON.stringify({
          streamId: 'st_x',
          state: 'idle',
          viewerCount: 0,
          createdAt: '2026-03-26T00:00:00.000Z',
          effectiveConfig: {
            transport: 'tcp',
            video: { mode: 'auto', codec: 'h264' },
            audio: { enabled: false, mode: 'drop', codec: 'aac', bitrateKbps: 0 },
          },
          stats: {
            bytesOut: 0,
            startAttempts: 0,
          },
        }),
        { status: 200 }
      )
    }
    if (String(input).endsWith('/v1/streams')) {
      return new Response('[]', { status: 200 })
    }
    return new Response('', { status: 204 })
  })
  vi.stubGlobal('fetch', fetchMock)

  await getStream('http://localhost:3000', 'st_x')
  await listStreams('http://localhost:3000')
  await deleteStream('http://localhost:3000', 'st_x')

  expect(calls).toEqual([
    { input: 'http://localhost:3000/v1/streams/st_x', method: 'GET', contentType: null },
    { input: 'http://localhost:3000/v1/streams', method: 'GET', contentType: null },
    { input: 'http://localhost:3000/v1/streams/st_x', method: 'DELETE', contentType: null },
  ])
})

test('getHealthz should return parsed payload', async () => {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    expect(String(input)).toBe('http://localhost:3000/v1/healthz')
    expect(init?.method).toBeUndefined()
    return new Response(
      JSON.stringify({
        status: 'ok',
        ffmpegPath: '/usr/bin/ffmpeg',
        uptimeSec: 42,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  })
  vi.stubGlobal('fetch', fetchMock)

  const result = await getHealthz('http://localhost:3000')
  expect(result.status).toBe('ok')
  expect(result.uptimeSec).toBe(42)
})

test('failed response should preserve requestId and structured code', async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ code: 'VIEWER_LIMIT_REACHED', message: 'too many viewers', requestId: 'req_1' }), {
        status: 400,
      })
  )
  vi.stubGlobal('fetch', fetchMock)

  await expect(createStream('http://localhost:3000', { url: 'rtsp://bad' })).rejects.toMatchObject({
    status: 400,
    code: 'VIEWER_LIMIT_REACHED',
    requestId: 'req_1',
  })

  await expect(createStream('http://localhost:3000', { url: 'rtsp://bad' })).rejects.toBeInstanceOf(ClientError)
})
