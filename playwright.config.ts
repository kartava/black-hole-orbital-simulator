import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173/black-hole-orbital-simulator/",
    headless: true,
  },
  webServer: {
    command: "yarn dev",
    url: "http://localhost:5173/black-hole-orbital-simulator/",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
