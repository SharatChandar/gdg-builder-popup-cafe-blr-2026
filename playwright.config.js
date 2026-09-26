import { defineConfig } from "@playwright/test";
export default defineConfig({
  timeout: 60000,
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  use: {
    baseURL: "http://localhost:8082",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `NODE_ENV=production DATA_STORE=pglite PORT=8082 DATA_PATH=/private/tmp/common-ground-e2e-${Date.now()} node server/index.js`,
    url: "http://localhost:8082/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
