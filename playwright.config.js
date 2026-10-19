import { defineConfig } from "@playwright/test";

// The Okey table in a real browser: phones in Turkish, desktop in English.
// Runs against the dev server, because the tests set up positions with the
// dev-only window.okey. Screenshots are compared only in Playwright's Linux
// image (npm run test:e2e, e2e/docker.sh) or a CI job in it: fonts render
// differently elsewhere. A plain `npx playwright test` skips them.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.js",
  fullyParallel: true,
  ignoreSnapshots: process.platform !== "linux",
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "phone",
      use: {
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        locale: "tr-TR",
      },
    },
    {
      name: "small-phone",
      use: {
        viewport: { width: 667, height: 320 },
        hasTouch: true,
        locale: "tr-TR",
      },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1348, height: 870 }, locale: "en-US" },
    },
  ],
});
