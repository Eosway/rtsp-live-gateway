import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../errors.js'
import { normalizeCreateRequest } from './normalize.js'

test('should reject unsupported video codec values', () => {
  assert.throws(
    () =>
      normalizeCreateRequest({
        url: 'rtsp://example.com/live',
        video: {
          mode: 'auto',
          codec: 'libx265',
        },
      }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, 'INVALID_ARGUMENT')
      assert.equal(error.detail?.field, 'video.codec')
      return true
    }
  )
})

test('should accept supported video codec values', () => {
  const normalized = normalizeCreateRequest({
    url: 'rtsp://example.com/live',
    video: {
      mode: 'transcode',
      codec: 'h265',
    },
  })

  assert.equal(normalized.video.mode, 'transcode')
  assert.equal(normalized.video.codec, 'h265')
})
