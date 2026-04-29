import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      insertTypesEntry: true,
      rollupTypes: true,
      bundledPackages: ['@rtsp-gateway/protocol'],
      tsconfigPath: resolve(__dirname, 'tsconfig.json'),
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rolldownOptions: {
      external: ['vue'],
      output: {
        chunkFileNames: '[name].js',
        codeSplitting: {
          groups: [
            {
              name: 'mpeg2ts',
              test: /mpegts\.js/,
            },
          ],
        },
      },
    },
  },
})
