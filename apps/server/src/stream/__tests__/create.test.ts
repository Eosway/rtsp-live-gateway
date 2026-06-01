import { expect, test } from 'vitest'
import { ApiError } from '../../errors.js'
import { resolveStreamCreateRequest } from '../create.js'

test('should reject unsupported video codec values', () => {
  let thrown: unknown

  try {
    resolveStreamCreateRequest({
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
  const resolved = resolveStreamCreateRequest({
    url: 'rtsp://example.com/live',
    video: {
      mode: 'transcode',
      codec: 'h265',
    },
  })

  expect(resolved.video.mode).toBe('transcode')
  expect(resolved.video.codec).toBe('h265')
})

test('should resolve disabled audio to an empty disabled shape', () => {
  const resolved = resolveStreamCreateRequest({
    url: 'rtsp://example.com/live',
    audio: {
      enabled: false,
    },
  })

  expect(resolved.audio).toEqual({
    enabled: false,
  })
})

test('should resolve enabled audio to auto mode', () => {
  const resolved = resolveStreamCreateRequest({
    url: 'rtsp://example.com/live',
    audio: {
      enabled: true,
      mode: 'auto',
    },
  })

  expect(resolved.audio).toEqual({
    enabled: true,
    mode: 'auto',
    codec: 'aac',
  })
})

test('should resolve enabled audio to aac auto by default', () => {
  const resolved = resolveStreamCreateRequest({
    url: 'rtsp://example.com/live',
    audio: {
      enabled: true,
    },
  })

  expect(resolved.audio).toEqual({
    enabled: true,
    mode: 'auto',
    codec: 'aac',
  })
})

test('should resolve transcode audio codec to mp3 when requested', () => {
  const resolved = resolveStreamCreateRequest({
    url: 'rtsp://example.com/live',
    audio: {
      enabled: true,
      mode: 'transcode',
      codec: 'mp3',
    },
  })

  expect(resolved.audio).toEqual({
    enabled: true,
    mode: 'transcode',
    codec: 'mp3',
  })
})

test('should accept audio codec when audio mode is auto', () => {
  const resolved = resolveStreamCreateRequest({
    url: 'rtsp://example.com/live',
    audio: {
      enabled: true,
      mode: 'auto',
      codec: 'mp3',
    },
  })

  expect(resolved.audio).toEqual({
    enabled: true,
    mode: 'auto',
    codec: 'mp3',
  })
})

test('should reject invalid audio mode', () => {
  let thrown: unknown

  try {
    resolveStreamCreateRequest({
      url: 'rtsp://example.com/live',
      audio: {
        enabled: true,
        mode: 'copy',
      },
    })
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(ApiError)
  expect(thrown).toMatchObject({
    code: 'INVALID_ARGUMENT',
    detail: {
      field: 'audio.mode',
    },
  })
})

test('should reject audio mode when audio is disabled', () => {
  let thrown: unknown

  try {
    resolveStreamCreateRequest({
      url: 'rtsp://example.com/live',
      audio: {
        enabled: false,
        mode: 'auto',
      },
    })
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(ApiError)
  expect(thrown).toMatchObject({
    code: 'INVALID_ARGUMENT',
    detail: {
      field: 'audio.mode',
    },
  })
})
