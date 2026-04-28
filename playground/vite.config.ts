import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@rtsp-gateway/client': resolve(__dirname, '../packages/client/src/index.ts'),
      '@rtsp-gateway/player-vue': resolve(__dirname, '../packages/player-vue/src/index.ts'),
      '@rtsp-gateway/protocol': resolve(__dirname, '../packages/protocol/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
