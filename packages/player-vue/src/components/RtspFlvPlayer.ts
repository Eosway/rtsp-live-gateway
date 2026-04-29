import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, type VNodeRef, useAttrs, watch } from 'vue'
import { useRtspFlvPlayer } from '../composables/useRtspFlvPlayer.js'
import type { MediaInfo, MediaPlayerConfig, RtspFlvPlayerError, RtspFlvPlayerProps, RtspFlvPlayerStatus, UseRtspFlvPlayerReturn } from '../types.js'

export const RtspFlvPlayer = defineComponent({
  name: 'RtspFlvPlayer',
  inheritAttrs: false,
  props: {
    baseUrl: { type: String, required: true },
    sourceConfig: {
      type: Object as PropType<RtspFlvPlayerProps['sourceConfig']>,
      required: true,
    },
    autoPlay: { type: Boolean, default: true },
    playerConfig: {
      type: Object as PropType<MediaPlayerConfig>,
      default: undefined,
    },
    cleanOnUnmount: { type: Boolean, default: false },
  },
  emits: {
    created: (_streamId: string) => true,
    statechange: (_state: { state: RtspFlvPlayerStatus }) => true,
    error: (_error: RtspFlvPlayerError) => true,
    mediainfo: (_mediaInfo: MediaInfo) => true,
    metadataarrived: (_metadata: unknown) => true,
    closed: (_reason: string) => true,
  },
  setup(props, { emit, expose }) {
    const attrs = useAttrs()
    const controller: UseRtspFlvPlayerReturn = useRtspFlvPlayer(
      () => ({
        baseUrl: props.baseUrl,
        sourceConfig: props.sourceConfig,
        autoPlay: props.autoPlay,
        playerConfig: props.playerConfig,
        cleanOnUnmount: props.cleanOnUnmount,
      }),
      {
        onCreated: (streamId) => {
          emit('created', streamId)
        },
        onStateChange: (state) => {
          emit('statechange', { state })
        },
        onError: (error) => {
          emit('error', error)
        },
        onMediaInfo: (mediaInfo) => {
          emit('mediainfo', mediaInfo)
        },
        onMetadataArrived: (metadata) => {
          emit('metadataarrived', metadata)
        },
        onClosed: (reason) => {
          emit('closed', reason)
        },
      }
    )
    const videoRef: VNodeRef = (videoEl) => {
      if (videoEl instanceof HTMLVideoElement) {
        controller.attach(videoEl)
      }
    }

    onMounted(() => {
      void controller.start()
    })

    watch(
      () => [props.baseUrl, props.sourceConfig, props.autoPlay, props.playerConfig] as const,
      () => {
        void controller.reload('props_changed')
      }
    )

    onBeforeUnmount(() => {
      void controller.detach('unmount')
    })

    expose({
      streamId: controller.streamId,
      state: controller.state,
      start: controller.start,
      stop: controller.stop,
      reload: controller.reload,
    })

    return () =>
      h('video', {
        ...attrs,
        ref: videoRef,
        style: [{ width: '100%', maxWidth: '100%' }, attrs.style],
      })
  },
})
