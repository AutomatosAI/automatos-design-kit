import { runValidate } from "./lib/validate-cli";

// Entry for `npm run validate <dir|file.autoskin>` (tsx). The logic is in lib/validate-cli.ts.

runValidate(process.argv.slice(2), { log: (line) => console.log(line), error: (line) => console.error(line) }).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error("validate stopped:", error);
    process.exitCode = 1;
  },
);
