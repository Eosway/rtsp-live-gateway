import assert from 'node:assert/strict'
import test from 'node:test'
import { ClientError, buildLiveUrl, createStream, deleteStream, getHealthz, getStream, listStreams } from '../dist/index.js'

test('buildLiveUrl should format expected flv endpoint', () => {
  const url = buildLiveUrl('http://localhost:3000/', 'st_demo')
  assert.equal(url, 'http://localhost:3000/v1/live/st_demo')
})

test('createStream should POST and return parsed payload', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://localhost:3000/v1/streams')
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('content-type'), 'application/json')
    return new Response(
      JSON.stringify({
        streamId: 'st_1',
        state: 'idle',
        reused: false,
        createdAt: '2026-03-26T00:00:00.000Z',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  try {
    const result = await createStream('http://localhost:3000', {
      url: 'rtsp://example/live',
    })
    assert.equal(result.streamId, 'st_1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('get/list/delete should hit expected paths', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
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
            video: {
              codec: 'h264',
            },
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
  }

  try {
    await getStream('http://localhost:3000', 'st_x')
    await listStreams('http://localhost:3000')
    await deleteStream('http://localhost:3000', 'st_x')
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(calls, [
    { input: 'http://localhost:3000/v1/streams/st_x', method: 'GET', contentType: null },
    { input: 'http://localhost:3000/v1/streams', method: 'GET', contentType: null },
    { input: 'http://localhost:3000/v1/streams/st_x', method: 'DELETE', contentType: null },
  ])
})

test('getHealthz should return parsed payload', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://localhost:3000/v1/healthz')
    assert.equal(init?.method, undefined)
    return new Response(
      JSON.stringify({
        status: 'ok',
        ffmpegPath: '/usr/bin/ffmpeg',
        uptimeSec: 42,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  try {
    const result = await getHealthz('http://localhost:3000')
    assert.equal(result.status, 'ok')
    assert.equal(result.uptimeSec, 42)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('failed response should preserve requestId and structured code', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 'VIEWER_LIMIT_REACHED', message: 'too many viewers', requestId: 'req_1' }), {
      status: 400,
    })

  try {
    await assert.rejects(
      () => createStream('http://localhost:3000', { url: 'rtsp://bad' }),
      (error) => {
        assert.ok(error instanceof ClientError)
        assert.equal(error.status, 400)
        assert.equal(error.code, 'VIEWER_LIMIT_REACHED')
        assert.equal(error.requestId, 'req_1')
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
