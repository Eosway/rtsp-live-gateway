import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  outDir: 'dist',
  target: 'node24',
  sourcemap: true,
  clean: true,
  dts: false,
  fixedExtension: false,
  deps: {
    neverBundle: ['@hono/node-server', 'hono', '@ffmpeg-installer/ffmpeg', '@eosway/rtsp-live-gateway-protocol'],
  },
})
