import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  outDir: 'dist',
  target: 'node24',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: false,
  fixedExtension: false,
  external: ['@hono/node-server', 'hono', '@ffmpeg-installer/ffmpeg', '@rtsp-gateway/protocol'],
})
