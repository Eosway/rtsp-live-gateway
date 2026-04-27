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
        <label class="checkbox">
          <input v-model="form.allowPrivateIp" type="checkbox" />
          允许私网地址（仅开发联调）
        </label>
      </div>

      <div class="actions">
        <button :disabled="!form.url" @click="openPlayer">创建并播放</button>
        <button class="ghost" @click="closePlayer">关闭播放器</button>
      </div>

      <p class="status">{{ status }}</p>
    </section>

    <section v-if="showPlayer" class="panel">
      <RtspFlvPlayer
        :base-url="baseUrl"
        mode="create"
        :create-request="createRequest"
        :autoplay="true"
        :muted="true"
        :stash-buffer="false"
        :destroy-on-unmount="true"
        @created="onCreated"
        @statechange="onStateChange"
        @error="onError"
        @closed="onClosed" />
      <p class="stream-id">当前 Stream ID: {{ currentStreamId || '-' }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { StreamCreateRequest } from '@rtsp-gateway/client'
import { RtspFlvPlayer } from '@rtsp-gateway/player-vue'
import { computed, reactive, ref } from 'vue'

const baseUrl = ref('http://localhost:3000')
const status = ref('等待创建流')
const currentStreamId = ref('')
const showPlayer = ref(false)

const form = reactive({
  url: '',
  transport: 'tcp' as StreamCreateRequest['transport'],
  allowPrivateIp: false,
})

const createRequest = computed<StreamCreateRequest>(() => ({
  url: form.url,
  transport: form.transport,
  allowPrivateIp: form.allowPrivateIp,
  video: {
    mode: 'auto',
  },
  audio: {
    enabled: false,
  },
}))

function openPlayer() {
  showPlayer.value = true
  status.value = '正在创建流并启动播放...'
}

function closePlayer() {
  showPlayer.value = false
  currentStreamId.value = ''
  status.value = '播放器已关闭'
}

function onCreated(streamId: string) {
  currentStreamId.value = streamId
}

function onStateChange(payload: { state: string }) {
  status.value = `播放器状态: ${payload.state}`
}

function onError(payload: { code: string; message: string }) {
  status.value = `错误(${payload.code}): ${payload.message}`
}

function onClosed(reason: string) {
  status.value = `连接关闭: ${reason}`
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

input,
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
