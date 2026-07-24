import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    fileParallelism: false,
    setupFiles: ["./src/tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/src/tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
