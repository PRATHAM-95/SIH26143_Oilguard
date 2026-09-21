import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
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
