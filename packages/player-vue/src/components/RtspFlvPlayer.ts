import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, useAttrs, watch } from 'vue'
import { useRtspFlvPlayer } from '../composables/useRtspFlvPlayer.js'
import type {
  MediaInfo,
  PlayerWarning,
  ReconnectInfo,
  RecoveryInfo,
  RivmuxPlayerOptions,
  RtspFlvPlayerController,
  RtspFlvPlayerError,
  RtspFlvPlayerOptions,
} from '../types.js'

export const RtspFlvPlayer = defineComponent({
  name: 'RtspFlvPlayer',
  inheritAttrs: false,
  props: {
    serverUrl: { type: String, required: true },
    sourceConfig: {
      type: Object as PropType<RtspFlvPlayerOptions['sourceConfig']>,
      required: true,
    },
    playerOptions: {
      type: Object as PropType<RivmuxPlayerOptions>,
      default: undefined,
    },
  },
  emits: {
    started: () => true,
    stopped: () => true,
    destroyed: () => true,
    error: (_error: RtspFlvPlayerError) => true,
    mediaInfo: (_mediaInfo: MediaInfo) => true,
    warning: (_warning: PlayerWarning) => true,
    reconnecting: (_info: ReconnectInfo) => true,
    recovered: (_info: RecoveryInfo) => true,
  },
  setup(props, { emit, expose }) {
    const attrs = useAttrs()
    const controller: RtspFlvPlayerController = useRtspFlvPlayer(
      () => ({
        serverUrl: props.serverUrl,
        sourceConfig: props.sourceConfig,
        playerOptions: props.playerOptions,
      }),
      {
        onStarted: () => {
          emit('started')
        },
        onStopped: () => {
          emit('stopped')
        },
        onDestroyed: () => {
          emit('destroyed')
        },
        onError: (error) => {
          emit('error', error)
        },
        onMediaInfo: (mediaInfo) => {
          emit('mediaInfo', mediaInfo)
        },
        onWarning: (warning) => {
          emit('warning', warning)
        },
        onReconnecting: (info) => {
          emit('reconnecting', info)
        },
        onRecovered: (info) => {
          emit('recovered', info)
        },
      }
    )
    const videoRef = (videoEl: unknown) => {
      if (videoEl instanceof HTMLVideoElement) {
        controller.attach(videoEl)
      }
    }

    onMounted(() => {
      void controller.start()
    })

    watch(
      () => [props.serverUrl, props.sourceConfig, props.playerOptions] as const,
      () => {
        void controller.restart()
      },
      { deep: true }
    )

    onBeforeUnmount(() => {
      void controller.destroy()
    })

    expose({
      status: controller.status,
      start: controller.start,
      stop: controller.stop,
      restart: controller.restart,
      destroy: controller.destroy,
    })

    return () =>
      h('video', {
        ...attrs,
        ref: videoRef,
        style: [{ width: '100%', maxWidth: '100%' }, attrs.style],
      })
  },
})
