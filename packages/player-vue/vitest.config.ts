import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['source', 'module', 'browser', 'development|production'],
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
