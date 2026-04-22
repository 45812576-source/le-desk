import { defineConfig } from "@playwright/test";

const port = Number(process.env.HARNESS_E2E_FRONTEND_PORT ?? "5023");
const baseURL = process.env.HARNESS_E2E_FRONTEND_URL ?? `http://localhost:${port}`;
const skipWebServer = process.env.HARNESS_E2E_SKIP_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { outputFolder: "test-results/harness-engineering-report", open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: process.env.HARNESS_E2E_WEB_SERVER_COMMAND ?? "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
