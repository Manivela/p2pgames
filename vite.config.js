/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    /* for example, use global to avoid globals imports (describe, test, expect): */
    // globals: true,
    cache: false,
  },
});
