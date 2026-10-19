import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./identity",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:5173", trace: "off" },
  webServer: [
    ...[
      "customer-data-service",
      "assessment-service",
      "reporting-service",
      "api-gateway",
    ].map((service, index) => ({
      command: `../../scripts/run-service.sh ${service}`,
      url: `http://127.0.0.1:${[8081, 8082, 8083, 8080][index]}/actuator/health/liveness`,
      reuseExistingServer: false,
      timeout: 120000,
      stdout: "ignore" as const,
      stderr: "pipe" as const,
    })),
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
