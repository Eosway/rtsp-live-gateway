import { PlaybackSession } from "./PlaybackSession.js";

export class FanoutHub {
  private readonly sessions = new Map<string, PlaybackSession>();

  publish(chunk: Uint8Array): void {
    for (const [sessionId, session] of this.sessions) {
      if (!session.enqueue(chunk)) {
        this.sessions.delete(sessionId);
      }
    }
  }

  subscribe(session: PlaybackSession): void {
    this.sessions.set(session.sessionId, session);
  }

  unsubscribe(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.close(reason);
    this.sessions.delete(sessionId);
  }

  closeAll(reason: string): void {
    for (const [sessionId, session] of this.sessions) {
      session.close(reason);
      this.sessions.delete(sessionId);
    }
  }
}

