import { defineConfig, devices } from '@playwright/test'

// When BASE_URL is set, tests run against an external server (e.g. a porting
// project's dev server). The built-in webServer is skipped entirely.
const externalBase = process.env.BASE_URL

export default defineConfig({
  testDir: '.',
  testMatch: [
    'tests/*.e2e.test.js',
    'src/partials/components/**/tests/*.e2e.test.js',
    'src/kernel/**/tests/*.e2e.test.js',
  ],
  use: {
    baseURL: externalBase ?? 'http://localhost:5175',
    ...devices['Desktop Chrome'],
  },
  webServer: externalBase ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
  },
})
