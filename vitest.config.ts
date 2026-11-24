import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Two projects, one per side of the merged tree: the website tests need
// jsdom + the testing-library setup; the resource-extract tests need a
// plain node environment (jsdom's URL base breaks their file:// contract
// loading) and no browser setup.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "resource-extract",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
