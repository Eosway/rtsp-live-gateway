type ByteArray = Uint8Array<ArrayBufferLike>

export interface FlvStreamUnit {
  kind: 'header' | 'tag'
  bytes: ByteArray
  tagType?: number
  isMetadataTag?: boolean
  isAudioSequenceHeader?: boolean
  isVideoSequenceHeader?: boolean
  isKeyframe?: boolean
}

function appendUint8Array(left: ByteArray, right: ByteArray): ByteArray {
  return Uint8Array.from([...left, ...right])
}

function copyUint8Array(source: ByteArray): ByteArray {
  return Uint8Array.from(source)
}

function readUint24(buffer: ByteArray, offset: number): number {
  return (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2]
}

function readTagType(tag: ByteArray): number {
  return tag[0] ?? 0
}

function readVideoCodecId(tagBody: ByteArray): number | undefined {
  if (tagBody.byteLength === 0) {
    return undefined
  }
  return tagBody[0] & 0x0f
}

function isVideoSequenceHeader(tagBody: ByteArray): boolean {
  if (tagBody.byteLength < 2) {
    return false
  }
  const codecId = readVideoCodecId(tagBody)
  if (codecId !== 7 && codecId !== 12) {
    return false
  }
  return tagBody[1] === 0
}

function isAudioSequenceHeader(tagBody: ByteArray): boolean {
  if (tagBody.byteLength < 2) {
    return false
  }
  const soundFormat = (tagBody[0] >> 4) & 0x0f
  if (soundFormat !== 10) {
    return false
  }
  return tagBody[1] === 0
}

function isKeyframeVideoTag(tagBody: ByteArray): boolean {
  if (tagBody.byteLength === 0) {
    return false
  }
  const frameType = (tagBody[0] >> 4) & 0x0f
  return frameType === 1
}

function describeTag(tagBytes: ByteArray): FlvStreamUnit {
  const tagType = readTagType(tagBytes)
  const dataSize = readUint24(tagBytes, 1)
  const body = tagBytes.slice(11, 11 + dataSize)

  return {
    kind: 'tag',
    bytes: copyUint8Array(tagBytes),
    tagType,
    isMetadataTag: tagType === 18,
    isAudioSequenceHeader: tagType === 8 && isAudioSequenceHeader(body),
    isVideoSequenceHeader: tagType === 9 && isVideoSequenceHeader(body),
    isKeyframe: tagType === 9 && isKeyframeVideoTag(body),
  }
}

export class FlvStreamParser {
  private buffer: ByteArray = new Uint8Array()
  private headerParsed = false

  push(chunk: ByteArray): FlvStreamUnit[] {
    if (chunk.byteLength === 0) {
      return []
    }

    this.buffer = appendUint8Array(this.buffer, chunk)
    const units: FlvStreamUnit[] = []

    if (!this.headerParsed) {
      if (this.buffer.byteLength < 13) {
        return units
      }
      if (this.buffer[0] !== 0x46 || this.buffer[1] !== 0x4c || this.buffer[2] !== 0x56) {
        throw new Error('Invalid FLV signature in FFmpeg output')
      }
      units.push({
        kind: 'header',
        bytes: copyUint8Array(this.buffer.slice(0, 13)),
      })
      this.buffer = copyUint8Array(this.buffer.slice(13))
      this.headerParsed = true
    }

    while (this.buffer.byteLength >= 15) {
      const dataSize = readUint24(this.buffer, 1)
      const totalTagSize = 11 + dataSize + 4
      if (this.buffer.byteLength < totalTagSize) {
        break
      }
      const tagBytes = this.buffer.slice(0, totalTagSize)
      units.push(describeTag(tagBytes))
      this.buffer = copyUint8Array(this.buffer.slice(totalTagSize))
    }

    return units
  }

  reset(): void {
    this.buffer = new Uint8Array()
    this.headerParsed = false
  }
}

export class FlvBootstrapCache {
  private header?: ByteArray
  private metadataTag?: ByteArray
  private audioSequenceHeader?: ByteArray
  private videoSequenceHeader?: ByteArray

  observe(unit: FlvStreamUnit): void {
    if (unit.kind === 'header') {
      this.header = copyUint8Array(unit.bytes)
      return
    }

    if (unit.isMetadataTag) {
      this.metadataTag = copyUint8Array(unit.bytes)
      return
    }

    if (unit.isAudioSequenceHeader) {
      this.audioSequenceHeader = copyUint8Array(unit.bytes)
      return
    }

    if (unit.isVideoSequenceHeader) {
      this.videoSequenceHeader = copyUint8Array(unit.bytes)
    }
  }

  snapshot(): ByteArray[] | undefined {
    if (!this.header) {
      return undefined
    }

    const chunks: ByteArray[] = [copyUint8Array(this.header)]
    if (this.metadataTag) {
      chunks.push(copyUint8Array(this.metadataTag))
    }
    if (this.audioSequenceHeader) {
      chunks.push(copyUint8Array(this.audioSequenceHeader))
    }
    if (this.videoSequenceHeader) {
      chunks.push(copyUint8Array(this.videoSequenceHeader))
    }
    return chunks
  }

  reset(): void {
    this.header = undefined
    this.metadataTag = undefined
    this.audioSequenceHeader = undefined
    this.videoSequenceHeader = undefined
  }
}
