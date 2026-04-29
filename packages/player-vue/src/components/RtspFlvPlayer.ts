import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, type VNodeRef, watch } from 'vue'
import { useRtspFlvPlayer } from '../composables/useRtspFlvPlayer.js'
import type { MediaInfo, RtspFlvPlayerError, RtspFlvPlayerProps, RtspFlvPlayerStatus, UseRtspFlvPlayerReturn } from '../types.js'

export const RtspFlvPlayer = defineComponent({
  name: 'RtspFlvPlayer',
  props: {
    baseUrl: { type: String, required: true },
    sourceConfig: {
      type: Object as PropType<RtspFlvPlayerProps['sourceConfig']>,
      required: true,
    },
    autoPlay: { type: Boolean, default: true },
    muted: { type: Boolean, default: true },
    stashBuffer: { type: Boolean, default: false },
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
    const controller: UseRtspFlvPlayerReturn = useRtspFlvPlayer(
      () => ({
        baseUrl: props.baseUrl,
        sourceConfig: props.sourceConfig,
        autoPlay: props.autoPlay,
        stashBuffer: props.stashBuffer,
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
      () => [props.baseUrl, props.sourceConfig, props.autoPlay, props.stashBuffer] as const,
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
        ref: videoRef,
        muted: props.muted,
        style: {
          width: '100%',
          maxWidth: '100%',
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
        },
      })
  },
})
