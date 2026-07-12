import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure domain logic (kcal, care scheduling, weight trend,
 * time/timezone helpers). Node environment — these functions have no DOM or DB
 * dependency. `resolve.tsconfigPaths` makes the `@/…` alias resolve natively.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
