import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@azure/functions': fileURLToPath(new URL('./tests/mocks/azure-functions.ts', import.meta.url)),
      '@azure/storage-blob': fileURLToPath(new URL('./tests/mocks/azure-storage-blob.ts', import.meta.url)),
      openai: fileURLToPath(new URL('./tests/mocks/openai.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**', 'api/src/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
