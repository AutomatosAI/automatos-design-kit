// PRD-261 B-06a: throwaway git repositories for the proof tests (tests/proof*.test.ts). A made-up kit at a base tag
// (the kit's own proof/ files, a Command folder, a fixture copy of it, its test, Play, a lockfile and a skill), and a
// proof branch made from it as scripts/proof/launch.sh makes one. git runs with no system or user config, a fixed
// identity and no prompts. Nothing here runs a script under test.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const BASE_TAG = "kit-b06-base";
export const PROOF_ID = "b06";
export const SLUG = "harbour";
export const BRANCH = `proof/${PROOF_ID}-${SLUG}`;
export const THEME_PACKAGE = "@acme/theme-harbour";
export const LOCKFILE = "package-lock.json";
export const LEAK_LIST = "proof/leak-paths.txt";
/** The Command folder, joined at run time: tests/references.test.ts fails any other tracked file that names it whole. */
export const COMMAND_FOLDER = ["references", "designs", "command"].join("/");
/** A fixture copy of Command's looks, which the leak list's fixture glob takes. */
export const COMMAND_FIXTURE = "packages/theme-cli/test/fixtures/core/command-looks.json";
export const REFERENCES_TEST = "tests/references.test.ts";
/** The subject of the launcher's deletion commit (scripts/proof/launch.sh), which the audit's content check finds. */
export const REMOVAL_MESSAGE = `proof(${PROOF_ID}): remove the leak paths before the run`;
/** The files the made-up kit's leak list takes out. */
export const LEAK_FILES = [`${COMMAND_FOLDER}/README.md`, `${COMMAND_FOLDER}/looks/schema.json`, COMMAND_FIXTURE, REFERENCES_TEST];
/** The kit's own proof files, copied into the made-up kit so the tests prove the real ones. */
const PROOF_FILES = ["proof/leak-paths.txt", "proof/PROMPT.md", "proof/run-settings.json", "proof/README.md"];

type Files = Readonly<Record<string, string>>;
type Json = Readonly<Record<string, unknown>>;

/** A new folder under the system's temporary folder. */
export function sandbox(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** The environment git (and a script that runs git) gets: no system or user config, a fixed identity, no prompts. */
export function gitEnv(home: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: devNull,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "Kit Test",
    GIT_AUTHOR_EMAIL: "kit-test@example.com",
    GIT_COMMITTER_NAME: "Kit Test",
    GIT_COMMITTER_EMAIL: "kit-test@example.com",
  };
}

export function git(cwd: string, args: readonly string[], home: string): string {
  const run = spawnSync("git", args, { cwd, env: gitEnv(home), encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}

export function writeFiles(repo: string, files: Files): void {
  Object.entries(files).forEach(([rel, body]) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), body);
  });
}

/** Writes `files` and commits them (and anything else already staged). */
export function commitFiles(repo: string, files: Files, home: string, message = "change"): void {
  writeFiles(repo, files);
  git(repo, ["add", "--", ...Object.keys(files)], home);
  git(repo, ["commit", "-q", "-m", message], home);
}

export const lockText = (lock: Json): string => `${JSON.stringify(lock, null, 2)}\n`;

/** The made-up kit's lockfile: the root, Play's workspace and its link, and one outside package. */
export function baseLock(): Json {
  return {
    name: "automatos-design-kit",
    version: "0.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": { name: "automatos-design-kit", version: "0.0.0", workspaces: ["packages/*", "themes/*"] },
      "node_modules/@automatos/theme-play": { resolved: "themes/play", link: true },
      "node_modules/eslint": { version: "9.39.5", dev: true },
      "themes/play": { name: "@automatos/theme-play", version: "1.0.0" },
    },
  };
}

/** The lockfile once npm install has added the proof's workspace: its folder and its link, nothing else. */
export function proofLock(extra: Json = {}): Json {
  const base = baseLock();
  return {
    ...base,
    packages: {
      ...(base.packages as Json),
      [`node_modules/${THEME_PACKAGE}`]: { resolved: `themes/${SLUG}`, link: true },
      [`themes/${SLUG}`]: { name: THEME_PACKAGE, version: "0.1.0" },
      ...extra,
    },
  };
}

/** The made-up kit at the base: the kit's own proof files, the leak paths, Play, a lockfile, a skill. */
export function baseFiles(): Files {
  const proof = Object.fromEntries(PROOF_FILES.map((rel) => [rel, readFileSync(join(ROOT, rel), "utf8")]));
  const leaks = Object.fromEntries(LEAK_FILES.map((rel) => [rel, `made up: ${rel}\n`]));
  return {
    ...proof,
    ...leaks,
    "README.md": "# kit\n",
    "packages/theme-cli/test/fixtures/core/hello/theme.json": "{}\n",
    "themes/play/theme.json": "{}\n",
    "skills/build-a-theme/SKILL.md": "# a skill\n",
    [LOCKFILE]: lockText(baseLock()),
  };
}

/** The proof's own files: its theme folder and its proof folder. */
export function themeFiles(): Files {
  return {
    [`themes/${SLUG}/package.json`]: `${JSON.stringify({ name: THEME_PACKAGE, version: "0.1.0" })}\n`,
    [`themes/${SLUG}/theme.json`]: "{}\n",
    [`themes/${SLUG}/src/entry.ts`]: "export default {};\n",
    [`proof/${PROOF_ID}/GAPS.md`]: "# Gaps\n",
  };
}

/** A new repository holding the made-up kit, tagged as the base. */
export function upstream(home: string): string {
  const repo = mkdtempSync(join(home, "upstream-"));
  git(repo, ["init", "-q", "-b", "main"], home);
  commitFiles(repo, baseFiles(), home, "the kit");
  git(repo, ["tag", BASE_TAG], home);
  return repo;
}

/** The made-up kit with a proof branch on it, as the launcher and a clean run leave it. */
export function proofRepo(home: string): string {
  const repo = upstream(home);
  git(repo, ["switch", "-q", "-c", BRANCH], home);
  git(repo, ["rm", "-r", "-q", "--", ...LEAK_FILES], home);
  git(repo, ["commit", "-q", "-m", REMOVAL_MESSAGE], home);
  commitFiles(repo, { ...themeFiles(), [`proof/${PROOF_ID}/BASE`]: `${BASE_TAG}\n`, [LOCKFILE]: lockText(proofLock()) }, home, "the theme");
  return repo;
}
