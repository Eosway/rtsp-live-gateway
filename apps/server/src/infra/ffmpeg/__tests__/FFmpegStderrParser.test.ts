import { expect, test } from 'vitest'
import { FFmpegStderrParser, summarizeStderrTail } from '../FFmpegStderrParser.js'

test('should classify 404 not found as upstream_not_found with readable summary', () => {
  const parser = new FFmpegStderrParser()
  const event = parser.parse('[rtsp @ 0x7feabd0cc380] method OPTIONS failed: 404 Not Found')

  expect(event).toBeTruthy()
  expect(event).toMatchObject({
    code: 'UPSTREAM_NOT_FOUND',
    reason: 'not_found',
    summary: 'RTSP upstream returned 404 Not Found',
  })
})

test('should sanitize rtsp credentials from stderr tail', () => {
  const lines = summarizeStderrTail(['Error opening input file rtsp://admin:secret@camera.local/live.'])
  expect(lines).toEqual(['Error opening input file rtsp://admin:***@camera.local/live.'])
})
