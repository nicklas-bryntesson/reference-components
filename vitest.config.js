import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/*.e2e.test.js', '**/*.e2e.test.ts', 'node_modules/**', '.worktrees/**'],
  },
})
