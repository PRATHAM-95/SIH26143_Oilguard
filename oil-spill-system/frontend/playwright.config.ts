import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // Opt in to a locally installed Chrome (e.g. PLAYWRIGHT_CHANNEL=chrome) when
    // the bundled Chromium download is unavailable. Unset keeps bundled Chromium.
    channel: process.env.PLAYWRIGHT_CHANNEL,
    launchOptions: {
      args: ['--use-gl=egl', '--ignore-gpu-blocklist'],
    },
    // No trace/video on default shots run to keep it fast
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
