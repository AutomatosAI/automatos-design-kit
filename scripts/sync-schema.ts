import { join } from "node:path";
import { runSyncSchema } from "./lib/sync-schema-cli";

// Entry for `npm run sync-schema [-- --from <automatos-ai checkout>]` (tsx). The logic is in
// lib/sync-schema-cli.ts. Run from the repo root (npm does), so spec/ is under the cwd.

runSyncSchema(
  process.argv.slice(2),
  { log: (line) => console.log(line), error: (line) => console.error(line) },
  {
    fetch: globalThis.fetch,
    importModule: (url) => import(url),
    specPath: join(process.cwd(), "spec", "automatos-skin.v1.schema.json"),
    now: () => new Date(),
  },
).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error("sync-schema stopped:", error);
    process.exitCode = 1;
  },
);
