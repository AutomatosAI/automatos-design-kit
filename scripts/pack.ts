import { runPack } from "./lib/pack-cli";

// Entry for `npm run pack <dir>` (tsx). The logic is in lib/pack-cli.ts.

runPack(process.argv.slice(2), { log: (line) => console.log(line), error: (line) => console.error(line) }).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error("pack stopped:", error);
    process.exitCode = 1;
  },
);
