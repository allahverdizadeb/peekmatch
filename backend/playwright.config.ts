import { defineConfig, devices } from '@playwright/test';

/** E2E smoke tests for the critical user journeys. Assumes both dev servers on their standard
 * ports; reuses them if already running (the normal case during development), otherwise starts
 * them itself. Uses whatever OPENAI_API_KEY is (or isn't) set in backend/.env — with a real
 * key, tests exercise the real OpenAI API; without one, they exercise the deterministic
 * offline-fallback analyzer (see CLAUDE.md), which is what CI should run to avoid depending on a
 * paid external API for the full suite. */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false, // most specs share the same analysis lifecycle end-to-end; keep it simple and serial
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '.',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      timeout: 30_000,
      stdout: 'pipe',
    },
    {
      command: 'npm run dev',
      cwd: '../frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
      stdout: 'pipe',
    },
  ],
});
