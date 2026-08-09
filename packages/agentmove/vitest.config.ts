import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e tests spawn the built CLI as a child process several times per test,
    // which can exceed the 5s default on slow CI runners (notably Windows).
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 65,
      },
    },
  },
});
