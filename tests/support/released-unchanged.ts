// PRD-261 C-06r (PB-4): throwaway git repositories for the released-unchanged tests: tests/released-unchanged.test.ts
// (Play's and HUD's cases and the script's own) and tests/released-unchanged-themes.test.ts (Arcade's, and every other
// folder under themes/). An upstream repository holds Play's, HUD's and Arcade's files and the kit library they
// bundle at one commit; checkout() clones it as kit CI's checkout does (one commit deep, no tags) and runScript() runs
// scripts/release/released-unchanged.mjs at the clone's root. git runs with no system or user config. The sandbox is
// made when a test file imports this module; vitest isolates each test file, so each one gets a sandbox of its own and
// removes it in its afterAll.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SCRIPT = fileURLToPath(new URL("../../scripts/release/released-unchanged.mjs", import.meta.url));
export const RELEASED = "1.1.0";
export const RELEASE_TAG = `play-v${RELEASED}`;
export const MANIFEST = "themes/play/theme.json";
export const SOURCE = "themes/play/src/entry.ts";
export const ASSET = "themes/play/assets/previews/home.png";
export const README = "themes/play/README.md";
export const CHANGELOG = "themes/play/CHANGELOG.md";
/** A file of a kit package Play bundles (PRD-261 B-01i): its src/ is packed as source/packages/mascot/src/. */
export const BUNDLED_SOURCE = "packages/mascot/src/player.ts";
/** The kit library's package.json: a theme bundles it when it names it under dependencies (the vite-preset's rule). */
export const LIBRARY = { "packages/mascot/package.json": '{ "name": "@automatos/mascot", "version": "0.1.0", "kitLibrary": true }\n' };
/** A theme's package.json naming the library, as Play's and HUD's do. */
export const themePackage = (name: string, extra: Readonly<Record<string, unknown>> = {}): string =>
  `${JSON.stringify({ name, version: "1.0.0", dependencies: { "@automatos/mascot": "0.1.0" }, ...extra })}\n`;
/** One file under each of Play's packed paths but theme.json, which manifest() writes. */
export const PACKED_FILES = {
  [SOURCE]: "export const entry = 1;\n",
  [BUNDLED_SOURCE]: "export const player = 1;\n",
  [ASSET]: "home preview\n",
  [README]: "# Play\n",
  [CHANGELOG]: "## 1.1.0\n\n- Release.\n",
};
/** Files outside Play's packed paths: a change to them never needs a new version. */
export const OUTSIDE_FILES = {
  "themes/play/package.json": themePackage("@automatos/theme-play"),
  "themes/play/test/entry.test.ts": "// a test\n",
  "themes/play/vite.config.ts": "export default {};\n",
  "packages/mascot/README.md": "# mascot\n",
  "README.md": "# kit\n",
};
export const OUTSIDE_CHANGES = {
  "themes/play/package.json": themePackage("@automatos/theme-play", { description: "Play" }),
  "themes/play/test/entry.test.ts": "// a test, reworded\n",
  "themes/play/vite.config.ts": "export default { base: './' };\n",
  "themes/play/signatures/1.1.0.sig.json": "{}\n",
  "packages/mascot/README.md": "# mascot, reworded\n",
  "README.md": "# kit, reworded\n",
};

// HUD, released by hud-v<version>: it commits boot/ and looks/, which its pack collects, so they are guarded too.
export const HUD_RELEASED = "1.0.0";
export const HUD_TAG = `hud-v${HUD_RELEASED}`;
export const HUD_MANIFEST = "themes/hud/theme.json";
export const HUD_SOURCE = "themes/hud/src/entry.ts";
export const HUD_PREPAINT = "themes/hud/boot/prepaint.json";
export const HUD_PRESET = "themes/hud/looks/presets/arc.look.json";
/** One file under each of HUD's packed paths but theme.json, which hudManifest() writes, and its package.json. */
export const HUD_PACKED_FILES = {
  "themes/hud/package.json": themePackage("@automatos/theme-hud"),
  [HUD_SOURCE]: "export const entry = 1;\n",
  [HUD_PREPAINT]: "{}\n",
  [HUD_PRESET]: '{ "id": "arc" }\n',
  "themes/hud/assets/fonts/README.md": "# fonts\n",
  "themes/hud/README.md": "# HUD\n",
  "themes/hud/CHANGELOG.md": "## 1.0.0\n\n- Release.\n",
};

// Arcade, released by arcade-v<version>: like HUD it commits boot/ and looks/, but it bundles @automatos/mascot
// alone, not @automatos/look-kit (its package.json names no look-kit dependency). The script finds it as it finds
// every folder under themes/, and guards it by its own arcade-v* tags.
export const ARCADE_RELEASED = "1.0.0";
export const ARCADE_MANIFEST = "themes/arcade/theme.json";
export const ARCADE_SOURCE = "themes/arcade/src/entry.ts";
export const ARCADE_PREPAINT = "themes/arcade/boot/prepaint.json";
export const ARCADE_PRESET = "themes/arcade/looks/presets/overworld.look.json";
/** One file under each of Arcade's packed paths but theme.json, which arcadeManifest() writes, and its package.json. */
export const ARCADE_PACKED_FILES = {
  "themes/arcade/package.json": themePackage("@automatos/theme-arcade"),
  [ARCADE_SOURCE]: "export const entry = 1;\n",
  [ARCADE_PREPAINT]: "{}\n",
  [ARCADE_PRESET]: '{ "id": "overworld" }\n',
  "themes/arcade/assets/fonts/README.md": "# fonts\n",
  "themes/arcade/README.md": "# Arcade\n",
  "themes/arcade/CHANGELOG.md": "## 1.0.0\n\n- Release.\n",
};

export const sandbox = mkdtempSync(join(tmpdir(), "released-unchanged-"));
/** git with no system or user config, a fixed identity, plain messages and no prompts. */
const GIT_ENV = {
  PATH: process.env.PATH ?? "", HOME: sandbox, LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull,
  GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_NAME: "Kit Test", GIT_AUTHOR_EMAIL: "kit-test@example.com",
  GIT_COMMITTER_NAME: "Kit Test", GIT_COMMITTER_EMAIL: "kit-test@example.com",
};

export interface Outcome {
  readonly status: number | null;
  readonly output: string;
  /** The changed paths the script named: its indented lines. */
  readonly named: readonly string[];
}

function git(cwd: string, args: readonly string[]): string {
  const run = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}

/** Play's theme.json at `version`. */
export function manifest(version: unknown, extra: Readonly<Record<string, unknown>> = {}): string {
  return `${JSON.stringify({ schema: "automatos-theme/v1", id: "automatos/play", version, ...extra }, null, 2)}\n`;
}

/** HUD's theme.json at `version`. */
export function hudManifest(version: unknown, extra: Readonly<Record<string, unknown>> = {}): string {
  return `${JSON.stringify({ schema: "automatos-theme/v1", id: "automatos/hud", version, ...extra }, null, 2)}\n`;
}

/** Arcade's theme.json at `version`. */
export function arcadeManifest(version: unknown, extra: Readonly<Record<string, unknown>> = {}): string {
  return `${JSON.stringify({ schema: "automatos-theme/v1", id: "automatos/arcade", version, ...extra }, null, 2)}\n`;
}

/** Writes `files` (repo-relative path to text) and commits them. */
export function commit(repo: string, files: Readonly<Record<string, string>>): void {
  Object.entries(files).forEach(([rel, body]) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), body);
  });
  git(repo, ["add", "--", ...Object.keys(files)]);
  git(repo, ["commit", "-q", "-m", `change ${Object.keys(files).join(", ")}`]);
}

export function removeAndCommit(repo: string, rel: string): void {
  git(repo, ["rm", "-q", "--", rel]);
  git(repo, ["commit", "-q", "-m", `remove ${rel}`]);
}

/**
 * A new upstream repository with one commit: Play at `version`, HUD at `hudVersion`, Arcade at `arcadeVersion`, and
 * files outside their packed paths.
 */
export function upstream(version: string = RELEASED, hudVersion: string = HUD_RELEASED, arcadeVersion: string = ARCADE_RELEASED): string {
  const repo = mkdtempSync(join(sandbox, "upstream-"));
  git(repo, ["init", "-q", "-b", "main"]);
  commit(repo, {
    [MANIFEST]: manifest(version), ...PACKED_FILES, ...OUTSIDE_FILES, ...LIBRARY,
    [HUD_MANIFEST]: hudManifest(hudVersion), ...HUD_PACKED_FILES,
    [ARCADE_MANIFEST]: arcadeManifest(arcadeVersion), ...ARCADE_PACKED_FILES,
  });
  return repo;
}

export function tag(repo: string, name: string, annotated = false): void {
  git(repo, annotated ? ["tag", "-a", name, "-m", name] : ["tag", name]);
}

/** Clones `repo` as kit CI's checkout does: its head commit only, no tags. */
export function checkout(repo: string): string {
  const clone = mkdtempSync(join(sandbox, "checkout-"));
  git(sandbox, ["clone", "-q", "--no-tags", "--depth", "1", pathToFileURL(repo).href, clone]);
  return clone;
}

/** Runs the script at the clone's root, as kit.yml's step does. */
export function runScript(clone: string, args: readonly string[] = []): Outcome {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: clone, env: GIT_ENV, encoding: "utf8" });
  const output = `${run.stdout}${run.stderr}`;
  const named = output.split("\n").filter((line) => line.startsWith("  ")).map((line) => line.trim());
  return { status: run.status, output, named };
}

export const check = (repo: string): Outcome => runScript(checkout(repo));
