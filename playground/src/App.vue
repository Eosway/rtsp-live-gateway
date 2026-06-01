<template>
  <main class="page">
    <section class="panel">
      <h1>RTSP Live Gateway Playground</h1>
      <p class="hint">输入 RTSP 参数并直接在浏览器中播放 HTTP-FLV。</p>

      <div class="grid">
        <label>
          Gateway Base URL
          <input v-model="baseUrl" placeholder="http://localhost:3000" />
        </label>
        <label>
          RTSP URL
          <input v-model="form.url" placeholder="rtsp://user:password@camera-host:554/Streaming/Channels/101" />
        </label>
        <label>
          Transport
          <select v-model="form.transport">
            <option value="tcp">tcp</option>
            <option value="udp">udp</option>
            <option value="udp_multicast">udp_multicast</option>
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </label>
        <label>
          Video Codec
          <select v-model="form.videoCodec">
            <option value="h264">AVC(libx264)</option>
            <option value="h265">HEVC(libx265)</option>
          </select>
        </label>
        <label class="checkbox">
          <input v-model="form.audioEnabled" type="checkbox" />
          <span>Enable Audio</span>
        </label>
        <label v-if="form.audioEnabled">
          Audio Codec
          <select v-model="form.audioCodec">
            <option value="aac">AAC</option>
            <option value="mp3">MP3</option>
          </select>
        </label>
      </div>

      <div class="actions">
        <button :disabled="!form.url" @click="openPlayer">创建并播放</button>
        <button class="ghost" @click="closePlayer">关闭播放器</button>
      </div>

      <p class="status">{{ statusMessage }}</p>
    </section>

    <section v-if="showPlayer" class="panel">
      <RtspFlvPlayer
        ref="playerRef"
        :base-url="baseUrl"
        :source-config="sourceConfig"
        :auto-play="true"
        muted
        playsinline
        :clean-on-unmount="true"
        @created="onCreated"
        @media-info="onMediaInfo"
        @error="onError"
        @closed="onClosed" />
      <p class="stream-id">当前 Stream ID: {{ currentStreamId || '-' }}</p>
      <p class="stream-id">当前 Player Status: {{ playerStatus }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { StreamCreateRequest } from '@eosway/rtsp-live-gateway-client'
import { RtspFlvPlayer } from '@eosway/rtsp-live-gateway-player-vue'
import type { RtspFlvPlayerStatus } from '@eosway/rtsp-live-gateway-player-vue'
import { computed, reactive, ref, type Ref } from 'vue'

type RtspFlvPlayerHandle = {
  streamId: Readonly<Ref<string | undefined>>
  status: Readonly<Ref<RtspFlvPlayerStatus>>
  start(): Promise<void>
  stop(reason?: string): Promise<void>
  reload(reason?: string): Promise<void>
}

const baseUrl = ref('http://localhost:3000')
const statusMessage = ref('等待创建流')
const showPlayer = ref(false)
const playerRef = ref<RtspFlvPlayerHandle>()
const currentStreamId = computed(() => playerRef.value?.streamId.value ?? '')
const playerStatus = computed<RtspFlvPlayerStatus>(() => playerRef.value?.status.value ?? 'idle')

const form = reactive({
  url: '',
  transport: 'tcp' as StreamCreateRequest['transport'],
  videoCodec: 'h264' as NonNullable<NonNullable<StreamCreateRequest['video']>['codec']>,
  audioEnabled: false,
  audioCodec: 'aac' as 'aac' | 'mp3',
})

const sourceConfig = computed<StreamCreateRequest>(() => ({
  url: form.url,
  transport: form.transport,
  video: {
    mode: 'auto',
    codec: form.videoCodec,
  },
  audio: form.audioEnabled
    ? {
        enabled: true,
        mode: 'auto',
        codec: form.audioCodec,
      }
    : {
        enabled: false,
      },
}))

function openPlayer() {
  showPlayer.value = true
  statusMessage.value = '正在创建流并启动播放...'
}

function closePlayer() {
  showPlayer.value = false
  statusMessage.value = '播放器已关闭'
}

function onCreated(streamId: string) {
  statusMessage.value = `已创建流: ${streamId}`
}

function onMediaInfo() {
  statusMessage.value = '播放器已开始接收媒体信息'
}

function onError(payload: { code: string; message: string }) {
  statusMessage.value = `错误(${payload.code}): ${payload.message}`
}

function onClosed(reason: string) {
  if (!showPlayer.value && reason === 'unmount') {
    statusMessage.value = '播放器已关闭'
    return
  }
  statusMessage.value = `连接关闭: ${reason}`
}
</script>

<style scoped>
.page {
  max-width: 980px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 16px;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #12212f;
}

.panel {
  border: 1px solid #d9e3ed;
  border-radius: 12px;
  padding: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f5f8fb 100%);
}

.hint {
  margin-top: 8px;
  color: #4c6478;
}

.grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 14px;
}

input:not([type='checkbox']),
select {
  border: 1px solid #b8c8d6;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox input {
  margin: 0;
}

.actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 10px 16px;
  background: #0b7d72;
  color: #fff;
  cursor: pointer;
}

button.ghost {
  background: #6f8798;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status,
.stream-id {
  margin-top: 12px;
  color: #2b475c;
  word-break: break-all;
}

@media (max-width: 768px) {
  .page {
    padding: 16px;
  }
}
</style>
