/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const build = Date.now();

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // the build's time: the page knows it as __BUILD__, and /version.json
  // tells an open page that a newer one is out (src/version.js). The dev
  // server says 0: a page on it that joins a room on the live site never
  // passes for a newer version
  define: { __BUILD__: command === "build" ? build : 0 },
  plugins: [
    react(),
    {
      name: "version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ build }),
        });
      },
    },
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
}));
