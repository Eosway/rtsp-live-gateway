export function maskRtspUrl(input: string): string {
  try {
    const url = new URL(input)
    if (url.password) {
      url.password = '***'
    }
    return url.toString()
  } catch {
    return input
  }
}

const RTSP_URL_PATTERN = /rtsps?:\/\/[^\s'"]+/gi

export function maskRtspUrlsInText(input: string): string {
  return input.replace(RTSP_URL_PATTERN, (matched) => maskRtspUrl(matched))
}
