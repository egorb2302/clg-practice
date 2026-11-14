import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../../.local/e2e-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3354",
    channel: process.env.E2E_CHANNEL ?? "msedge",
    viewport: { width: 1440, height: 900 },
    locale: "ru-RU",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
});
