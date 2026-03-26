import mpegtsModule from "mpegts.js";

export interface MpegtsPlayerState {
  attach(videoEl: HTMLVideoElement, url: string, stashBuffer: boolean): Promise<void>;
  play(): Promise<void>;
  destroy(): void;
}

export function createMpegtsPlayer(): MpegtsPlayerState {
  const mpegts = mpegtsModule as unknown as {
    isSupported(): boolean;
    createPlayer(
      source: {
        type: string;
        isLive: boolean;
        url: string;
        hasAudio: boolean;
        hasVideo: boolean;
      },
      config: { enableStashBuffer: boolean; liveBufferLatencyChasing: boolean }
    ): {
      attachMediaElement(mediaElement: HTMLMediaElement): void;
      load(): void;
      play(): Promise<void> | void;
      pause(): void;
      unload(): void;
      detachMediaElement(): void;
      destroy(): void;
    };
  };

  let player: ReturnType<typeof mpegts.createPlayer> | undefined;

  async function attach(videoEl: HTMLVideoElement, url: string, stashBuffer: boolean) {
    if (!mpegts.isSupported()) {
      throw new Error("mpegts.js is not supported in this browser");
    }
    destroy();

    player = mpegts.createPlayer(
      {
        type: "flv",
        isLive: true,
        url,
        hasAudio: false,
        hasVideo: true
      },
      {
        enableStashBuffer: stashBuffer,
        liveBufferLatencyChasing: true
      }
    );

    player.attachMediaElement(videoEl);
    player.load();
  }

  async function play() {
    if (!player) {
      return;
    }
    await player.play();
  }

  function destroy() {
    if (!player) {
      return;
    }
    player.pause();
    player.unload();
    player.detachMediaElement();
    player.destroy();
    player = undefined;
  }

  return {
    attach,
    play,
    destroy
  };
}
