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
  // past Playwright's default half: 6 workers on 8 cores took the suite
  // from 77 s to 69 s
  workers: "75%",
  ignoreSnapshots: process.platform !== "linux",
  // flat felt in the screenshots: its grain and dithered light make every
  // PNG ~6x bigger
  expect: {
    toHaveScreenshot: { stylePath: "e2e/screenshot.css" },
  },
  use: { baseURL: "http://localhost:5174" },
  // the dev server in e2e mode, which finds pages through a signaling
  // server here (src/constants.js), on a port of its own so a plain
  // `npm run dev` is never taken for it
  webServer: [
    {
      command: "node node_modules/y-webrtc/bin/server.js",
      url: "http://localhost:4444",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort --mode e2e",
      url: "http://localhost:5174",
      reuseExistingServer: true,
    },
  ],
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
