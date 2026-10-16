import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Avoid loading Next/Tailwind PostCSS plugins during Node unit tests
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
