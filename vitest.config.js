import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/*.e2e.test.js', '**/*.e2e.test.ts', 'node_modules/**', '.worktrees/**'],
  },
})
