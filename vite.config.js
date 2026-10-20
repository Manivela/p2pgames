/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // the source maps go to Sentry, to show the source of an error, and
    // never onto the site; the upload needs SENTRY_AUTH_TOKEN (set on the
    // Cloudflare Pages project), and without it the build just skips it
    sentryVitePlugin({
      org: "manivela",
      project: "p2pgames",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      telemetry: false,
    }),
  ],
  build: { sourcemap: "hidden" },
  test: {
    /* for example, use global to avoid globals imports (describe, test, expect): */
    // globals: true,
    cache: false,
  },
});
