import { expect, test } from 'vitest'
import { ApiError } from '../../errors.js'
import { normalizeCreateRequest } from '../normalize.js'

test('should reject unsupported video codec values', () => {
  let thrown: unknown

  try {
    normalizeCreateRequest({
      url: 'rtsp://example.com/live',
      video: {
        mode: 'auto',
        codec: 'libx265',
      },
    })
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(ApiError)
  expect(thrown).toMatchObject({
    code: 'INVALID_ARGUMENT',
    detail: {
      field: 'video.codec',
    },
  })
})

test('should accept supported video codec values', () => {
  const normalized = normalizeCreateRequest({
    url: 'rtsp://example.com/live',
    video: {
      mode: 'transcode',
      codec: 'h265',
    },
  })

  expect(normalized.video.mode).toBe('transcode')
  expect(normalized.video.codec).toBe('h265')
})
