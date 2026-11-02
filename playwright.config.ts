import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/ArchitecturePlanner/',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_BROWSER_PATH },
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/ArchitecturePlanner/',
      reuseExistingServer: false,
      env: { VITE_GITHUB_PARTICIPANTS: '[{"id":101,"login":"example-owner"},{"id":202,"login":"example-helper"}]' },
    },
    {
      command: 'npm run api:dev -- --port 8787 --var EDITOR_TOKEN:test-only-not-a-real-secret-1234567890 --var ALLOWED_ORIGIN:http://127.0.0.1:4173',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
})
