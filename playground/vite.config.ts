import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@eosway/rtsp-live-gateway-client': resolve(__dirname, '../packages/client/src/index.ts'),
      '@eosway/rtsp-live-gateway-player-vue': resolve(__dirname, '../packages/player-vue/src/index.ts'),
      '@eosway/rtsp-live-gateway-protocol': resolve(__dirname, '../packages/protocol/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
