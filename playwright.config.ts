import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://fixture.supabase.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-fixture-not-a-secret',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    {
      name: 'ipad-webkit',
      use: { ...devices['iPad (gen 7)'], browserName: 'webkit' },
      grep: /autocomplete:|lista autocomplete:|touch selettore:|lista preferenze:|catalogo prezzi:|categorie negozi:|confronto attuale:/,
    },
  ],
})
