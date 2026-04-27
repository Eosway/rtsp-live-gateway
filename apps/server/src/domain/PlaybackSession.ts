import { randomUUID } from 'node:crypto'

export interface PlaybackSessionMeta {
  streamId: string
  remoteIp?: string
  userAgent?: string
  maxQueueBytes: number
}

export class PlaybackSession {
  readonly sessionId: string
  readonly streamId: string
  readonly connectedAt: number
  readonly remoteIp?: string
  readonly userAgent?: string

  private readonly maxQueueBytes: number
  private readonly queue: Uint8Array[] = []
  private readonly waiters: Array<() => void> = []
  private queueBytes = 0
  private closed = false
  private closeReason?: string

  constructor(meta: PlaybackSessionMeta) {
    this.sessionId = `se_${randomUUID().replace(/-/g, '')}`
    this.streamId = meta.streamId
    this.remoteIp = meta.remoteIp
    this.userAgent = meta.userAgent
    this.connectedAt = Date.now()
    this.maxQueueBytes = meta.maxQueueBytes
  }

  enqueue(chunk: Uint8Array): boolean {
    if (this.closed) {
      return false
    }
    const next = this.queueBytes + chunk.byteLength
    if (next > this.maxQueueBytes) {
      this.close('slow_client')
      return false
    }
    this.queue.push(chunk)
    this.queueBytes = next
    const waiter = this.waiters.shift()
    waiter?.()
    return true
  }

  async drain(writer: (chunk: Uint8Array) => Promise<void>): Promise<void> {
    while (true) {
      if (this.queue.length === 0) {
        if (this.closed) {
          return
        }
        await new Promise<void>((resolve) => this.waiters.push(resolve))
        continue
      }
      const chunk = this.queue.shift()
      if (!chunk) {
        continue
      }
      this.queueBytes -= chunk.byteLength
      await writer(chunk)
    }
  }

  close(reason: string): void {
    if (this.closed) {
      return
    }
    this.closed = true
    this.closeReason = reason
    while (this.waiters.length > 0) {
      this.waiters.shift()?.()
    }
  }

  isClosed(): boolean {
    return this.closed
  }

  getCloseReason(): string | undefined {
    return this.closeReason
  }
}
