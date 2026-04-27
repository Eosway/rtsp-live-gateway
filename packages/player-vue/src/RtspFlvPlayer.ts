import { buildLiveUrl } from "@rtsp-gateway/sdk";
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType
} from "vue";
import { createMpegtsPlayer } from "./useMpegtsFlvPlayer.js";
import { cleanupStream, ensureStreamId } from "./useRtspStream.js";
import type { RtspFlvPlayerProps } from "./types.js";

export const RtspFlvPlayer = defineComponent({
  name: "RtspFlvPlayer",
  props: {
    baseUrl: { type: String, required: true },
    mode: {
      type: String as PropType<RtspFlvPlayerProps["mode"]>,
      required: true
    },
    streamId: { type: String, required: false },
    createRequest: {
      type: Object as PropType<RtspFlvPlayerProps["createRequest"]>,
      required: false
    },
    autoplay: { type: Boolean, default: true },
    muted: { type: Boolean, default: true },
    stashBuffer: { type: Boolean, default: false },
    destroyOnUnmount: { type: Boolean, default: false }
  },
  emits: {
    created: (_streamId: string) => true,
    statechange: (_state: { state: string }) => true,
    error: (_error: { code: string; message: string }) => true,
    closed: (_reason: string) => true
  },
  setup(props, { emit }) {
    const videoRef = ref<HTMLVideoElement>();
    const player = createMpegtsPlayer();
    const currentStreamId = ref<string>();
    const createdByComponent = ref(false);

    async function startPlayback() {
      if (!videoRef.value) {
        return;
      }

      emit("statechange", { state: "starting" });
      try {
        const ensured = await ensureStreamId({
          baseUrl: props.baseUrl,
          mode: props.mode,
          streamId: props.streamId,
          createRequest: props.createRequest
        });
        currentStreamId.value = ensured.streamId;
        createdByComponent.value = ensured.createdByComponent;
        emit("created", ensured.streamId);

        const liveUrl = buildLiveUrl(props.baseUrl, ensured.streamId);
        await player.attach(videoRef.value, liveUrl, props.stashBuffer);
        if (props.autoplay) {
          await player.play();
        }
        emit("statechange", { state: "running" });
      } catch (error) {
        emit("statechange", { state: "error" });
        emit("error", {
          code: "PLAYER_START_FAILED",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    async function stopPlayback(reason: string) {
      player.destroy();
      const streamId = currentStreamId.value;
      if (streamId) {
        await cleanupStream(
          props.baseUrl,
          streamId,
          Boolean(props.destroyOnUnmount && createdByComponent.value)
        );
      }
      emit("closed", reason);
      emit("statechange", { state: "idle" });
    }

    onMounted(() => {
      void startPlayback();
    });

    onBeforeUnmount(() => {
      void stopPlayback("unmount");
    });

    watch(
      () => [props.baseUrl, props.mode, props.streamId, props.createRequest] as const,
      () => {
        void stopPlayback("props_changed").then(() => startPlayback());
      }
    );

    return () =>
      h("video", {
        ref: videoRef,
        controls: true,
        playsInline: true,
        muted: props.muted,
        style: {
          width: "100%",
          maxWidth: "100%",
          backgroundColor: "#0a0a0a",
          borderRadius: "8px"
        }
      });
  }
});

