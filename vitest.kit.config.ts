// Root tests only: they check the kit's own contract (workspaces, pins, CI).
// Each workspace runs its own tests through its "test" script.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
