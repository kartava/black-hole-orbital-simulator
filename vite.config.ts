/// <reference types="vitest/config" />
import { resolve } from "path";

import { defineConfig } from "vite";

export default defineConfig({
  base: "/black-hole-orbital-simulator/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        guide: resolve(__dirname, "guide.html"),
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
