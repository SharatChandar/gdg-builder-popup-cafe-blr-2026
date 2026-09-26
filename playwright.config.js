import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    command: "node server/index.js",
    env: {
      NODE_ENV: "production",
      DATA_STORE: "pglite",
      DEMO_MODE: "true",
      PORT: "8082",
      DATA_PATH: join(tmpdir(), `common-ground-e2e-${Date.now()}`),
    },
    url: "http://localhost:8082/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
