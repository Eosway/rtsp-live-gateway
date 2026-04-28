import { ClientError, buildLiveUrl, createStream, deleteStream } from '@rtsp-gateway/client'
import type { StreamCreateRequest } from '@rtsp-gateway/client'
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { createMpegtsPlayer } from '../adapters/mpegtsPlayerAdapter.js'
import type { RtspFlvPlayerProps } from '../types.js'

async function ensureStreamId(options: {
  baseUrl: string
  mode: 'streamId' | 'create'
  streamId?: string
  createRequest?: StreamCreateRequest
}): Promise<{ streamId: string; createdByComponent: boolean }> {
  if (options.mode === 'streamId') {
    if (!options.streamId) {
      throw new Error('streamId is required in streamId mode')
    }
    return {
      streamId: options.streamId,
      createdByComponent: false,
    }
  }

  if (!options.createRequest) {
    throw new Error('createRequest is required in create mode')
  }
  const response = await createStream(options.baseUrl, options.createRequest)
  return {
    streamId: response.streamId,
    createdByComponent: true,
  }
}

async function cleanupStream(baseUrl: string, streamId: string, enabled: boolean): Promise<void> {
  if (!enabled) {
    return
  }
  try {
    await deleteStream(baseUrl, streamId)
  } catch {
    // 卸载清理失败时不抛出，避免影响页面生命周期。
  }
}

export const RtspFlvPlayer = defineComponent({
  name: 'RtspFlvPlayer',
  props: {
    baseUrl: { type: String, required: true },
    mode: {
      type: String as PropType<RtspFlvPlayerProps['mode']>,
      required: true,
    },
    streamId: { type: String, required: false },
    createRequest: {
      type: Object as PropType<RtspFlvPlayerProps['createRequest']>,
      required: false,
    },
    autoplay: { type: Boolean, default: true },
    muted: { type: Boolean, default: true },
    stashBuffer: { type: Boolean, default: false },
    destroyOnUnmount: { type: Boolean, default: false },
  },
  emits: {
    created: (_streamId: string) => true,
    statechange: (_state: { state: string }) => true,
    error: (_error: { code: string; message: string; status?: number; detail?: Record<string, unknown> }) => true,
    closed: (_reason: string) => true,
  },
  setup(props, { emit }) {
    const videoRef = ref<HTMLVideoElement>()
    const player = createMpegtsPlayer()
    const currentStreamId = ref<string>()
    const createdByComponent = ref(false)

    async function startPlayback() {
      if (!videoRef.value) {
        return
      }

      emit('statechange', { state: 'starting' })
      try {
        const ensured = await ensureStreamId({
          baseUrl: props.baseUrl,
          mode: props.mode,
          streamId: props.streamId,
          createRequest: props.createRequest,
        })
        currentStreamId.value = ensured.streamId
        createdByComponent.value = ensured.createdByComponent
        emit('created', ensured.streamId)

        const liveUrl = buildLiveUrl(props.baseUrl, ensured.streamId)
        await player.attach(videoRef.value, liveUrl, props.stashBuffer)
        if (props.autoplay) {
          await player.play()
        }
        emit('statechange', { state: 'running' })
      } catch (error) {
        emit('statechange', { state: 'error' })
        const clientError = error instanceof ClientError ? error : undefined
        emit('error', {
          code: clientError?.code ?? 'PLAYER_START_FAILED',
          message: error instanceof Error ? error.message : String(error),
          status: clientError?.status,
          detail: clientError?.detail,
        })
      }
    }

    async function stopPlayback(reason: string) {
      player.destroy()
      const streamId = currentStreamId.value
      if (streamId) {
        await cleanupStream(props.baseUrl, streamId, Boolean(props.destroyOnUnmount && createdByComponent.value))
      }
      emit('closed', reason)
      emit('statechange', { state: 'idle' })
    }

    onMounted(() => {
      void startPlayback()
    })

    onBeforeUnmount(() => {
      void stopPlayback('unmount')
    })

    watch(
      () => [props.baseUrl, props.mode, props.streamId, props.createRequest] as const,
      () => {
        void stopPlayback('props_changed').then(() => startPlayback())
      }
    )

    return () =>
      h('video', {
        ref: videoRef,
        controls: true,
        playsInline: true,
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
