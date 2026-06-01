import { FanoutHub } from '../../stream/fanoutHub.js'
import { PlaybackSession } from '../../stream/playbackSession.js'
import { FlvBootstrapCache, FlvGopCache, FlvStreamParser } from './parser.js'

interface FanoutPipelineOptions {
  gopCacheMaxBytes: number
}

export class FanoutPipeline {
  private readonly fanout = new FanoutHub()
  private readonly parser = new FlvStreamParser()
  private readonly bootstrapCache = new FlvBootstrapCache()
  private readonly gopCache: FlvGopCache
  private readonly pendingSessions = new Map<string, PlaybackSession>()

  constructor(options: FanoutPipelineOptions) {
    this.gopCache = new FlvGopCache(options.gopCacheMaxBytes)
  }

  addPendingSession(session: PlaybackSession): void {
    this.pendingSessions.set(session.sessionId, session)
  }

  removePendingSession(sessionId: string): void {
    this.pendingSessions.delete(sessionId)
  }

  closeAll(reason: string): void {
    this.fanout.closeAll(reason)
    for (const [sessionId, session] of this.pendingSessions) {
      session.close(reason)
      this.pendingSessions.delete(sessionId)
    }
  }

  publish(chunk: Uint8Array): { firstMediaSeen: boolean; bytesOutDelta: number; closedSessionIds: string[] } {
    const units = this.parser.push(chunk)
    let firstMediaSeen = false
    let bytesOutDelta = 0
    const closedSessionIds: string[] = []

    for (const unit of units) {
      firstMediaSeen = true
      bytesOutDelta += unit.bytes.byteLength

      if (unit.kind === 'header') {
        this.bootstrapCache.observe(unit)
        continue
      }

      this.activatePendingSessions(closedSessionIds)
      this.bootstrapCache.observe(unit)
      this.gopCache.observe(unit)
      this.fanout.publish(unit.bytes)
      this.activatePendingSessions(closedSessionIds)
    }

    return {
      firstMediaSeen,
      bytesOutDelta,
      closedSessionIds,
    }
  }

  unsubscribe(sessionId: string, reason: string): void {
    this.removePendingSession(sessionId)
    this.fanout.unsubscribe(sessionId, reason)
  }

  reset(): void {
    this.parser.reset()
    this.bootstrapCache.reset()
    this.gopCache.reset()
  }

  isReadyForPlayback(): boolean {
    return this.bootstrapCache.hasVideoSequenceHeader() && Boolean(this.gopCache.snapshot())
  }

  private activatePendingSessions(closedSessionIds: string[]): void {
    if (this.pendingSessions.size === 0) {
      return
    }
    const bootstrap = this.bootstrapCache.snapshot()
    if (!bootstrap) {
      return
    }

    const gop = this.gopCache.snapshot()
    if (!gop || gop.length === 0) {
      return
    }
    const preload = [...bootstrap, ...gop]

    for (const [sessionId, session] of this.pendingSessions) {
      this.pendingSessions.delete(sessionId)
      this.fanout.activate(session, preload)
      if (session.isClosed()) {
        closedSessionIds.push(sessionId)
      }
    }
  }
}
