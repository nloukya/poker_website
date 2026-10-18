import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  testDir: "./tests/shared",
  outputDir: "./test-results-shared",
  fullyParallel: false,
  use: { ...base.use, baseURL: "http://127.0.0.1:5174" },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    env: {
      VITE_SHARED_REQUIRED: "true",
      VITE_SUPABASE_URL: "https://shared-table.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_fixture",
    },
  },
});
