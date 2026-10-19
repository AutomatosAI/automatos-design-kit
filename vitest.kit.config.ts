// Root tests only: they check the kit's own contract (workspaces, pins, CI) and the review and
// sign scripts under scripts/. Each workspace runs its own tests through its "test" script.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The review tests run real Vite builds (a cold CI runner needs more than the 5 s default),
    // and the build changes the working folder, which a worker thread can't: child processes.
    testTimeout: 60_000,
    pool: "forks",
  },
});
