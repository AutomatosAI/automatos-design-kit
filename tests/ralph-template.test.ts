// PRD-261 B-01h: the Ralph theme-wave template (templates/ralph). run.sh refuses to start without an explicit model
// id and launch.sh refuses a start with no terminal: both are run here (CI only), with no model or with a pipe for
// stdin, and each must stop with its sentence before it reads or writes anything. theme-wave.json parses and every
// story names its file set, under the theme's folder. PROMPT_build.md says CI is the test, and every kit command the
// template names exists: each `automatos-theme <command>` is one the CLI has built, each `npm run <script>` a root
// script. Every placeholder of the prompts is one run.sh fills in, every sentinel they name is one run.sh reads, and
// no file names this repo, a local path, a planning file, a price or a person.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { COMMANDS } from "../packages/theme-cli/src/cli-main.ts";
import { ID_PATTERN } from "../packages/theme-cli/src/core/package-manifest.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEMPLATE = "templates/ralph";
const FILES = ["PROMPT_build.md", "PROMPT_cifix.md", "README.md", "launch.sh", "run.sh", "theme-wave.json"];
const TEXT_FILES = ["PROMPT_build.md", "PROMPT_cifix.md", "README.md", "theme-wave.json"];
const SCRIPTS = ["run.sh", "launch.sh"];
const CLI_MAIN = new URL("../packages/theme-cli/src/cli-main.ts", import.meta.url);
const EXPLICIT_MODEL = "claude-opus-5-5";
const ALIASES = ["opus", "sonnet", "haiku", "default", "claude-opus"];
const SCRIPT_TIMEOUT_MS = 10_000;
const EXIT_REFUSED_CONFIG = 2;
const EXIT_REFUSED_LAUNCH = 1;
const THEME_DIR = /^themes\/[a-z0-9][a-z0-9-]*$/;
const PLACEHOLDER = /\{\{([A-Z_]+)\}\}/g;
const CLI_COMMAND = /\bautomatos-theme[ \t]+([a-z][\w-]*)/g;
const NPM_SCRIPT = /\bnpm (?:run ([a-z][\w:-]*)|(test)\b)/g;
const BUILD_SENTINELS = ["STORY_DONE", "RALPH_COMPLETE", "RALPH_BLOCKED"];
const CIFIX_SENTINEL = "CI_FIX_DONE";
const FORBIDDEN_TEXT = [
  "AutomatosAI/automatos-play", "AutomatosAI/automatos-design-kit", "/Users/", "/home/", ".claude/", ".worktrees", "docs/prd/core", "scripts/ralph/prd-261.json",
  "DUMPING AREA", "HANDOFF", "phase-bc-plan",
];
const FORBIDDEN_PATTERNS = [/\bGerard\b/, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/];
/** A price in prose or data: a currency sign before a number. Scripts are left out ($1 is an argument there). */
const PRICE = /[$€£]\s?\d/;

interface Story {
  readonly id: string;
  readonly title: string;
  readonly priority: number;
  readonly passes: boolean;
  readonly files: readonly string[];
  readonly acceptanceCriteria: readonly string[];
}

interface Wave {
  readonly themeId: string;
  readonly themeDir: string;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly prBase: string;
  readonly userStories: readonly Story[];
}

const scratch = mkdtempSync(join(tmpdir(), "ralph-template-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const template = (name: string): string => readText(`${TEMPLATE}/${name}`);
const templateFiles = (): string[] => readdirSync(join(ROOT, TEMPLATE)).sort();

/** Runs one script with bash, stdin a pipe (no terminal), only PATH and HOME from the environment, plus `env`. */
function runScript(script: string, env: Readonly<Record<string, string>>): SpawnSyncReturns<string> {
  return spawnSync("bash", [join(ROOT, TEMPLATE, script)], {
    cwd: scratch,
    env: { PATH: process.env.PATH ?? "", HOME: scratch, ...env },
    input: "",
    encoding: "utf8",
    timeout: SCRIPT_TIMEOUT_MS,
  });
}

/** The commands the CLI has built: a row of COMMANDS whose module is there. */
const builtCommands = COMMANDS
  .filter((command) => existsSync(fileURLToPath(new URL(command.module, CLI_MAIN))))
  .map((command) => command.name);
const rootScripts = Object.keys(JSON.parse(readText("package.json")).scripts as Record<string, string>);

describe("the template's files", () => {
  it("are the six the story names", () => expect(templateFiles()).toEqual(FILES));

  it.each(SCRIPTS)("%s is a bash script with set -u, and executable", (script) => {
    const text = template(script);
    expect(text.startsWith("#!/bin/bash\n")).toBe(true);
    expect(text).toMatch(/^set -u/m);
    expect(statSync(join(ROOT, TEMPLATE, script)).mode & 0o111).not.toBe(0);
  });
});

describe("run.sh refuses to start without an explicit model id", () => {
  it("refuses with no RALPH_MODEL, before it reads or writes anything", () => {
    const result = runScript("run.sh", {});
    expect(result.status).toBe(EXIT_REFUSED_CONFIG);
    expect(result.stderr).toMatch(/RALPH_MODEL is not set/);
    expect(templateFiles()).toEqual(FILES);
    expect(readdirSync(scratch)).toEqual([]);
  });

  it("refuses an empty RALPH_MODEL", () => {
    const result = runScript("run.sh", { RALPH_MODEL: "" });
    expect(result.status).toBe(EXIT_REFUSED_CONFIG);
    expect(result.stderr).toMatch(/RALPH_MODEL is not set/);
  });

  it.each(ALIASES)("refuses the alias %s", (alias) => {
    const result = runScript("run.sh", { RALPH_MODEL: alias });
    expect(result.status).toBe(EXIT_REFUSED_CONFIG);
    expect(result.stderr).toMatch(/is not a model id/);
    expect(templateFiles()).toEqual(FILES);
  });

  it("gives every session that model, and neither script has a default one", () => {
    expect(template("run.sh")).toMatch(/claude --print \\\n\s+--model "\$RALPH_MODEL"/);
    for (const script of SCRIPTS) {
      expect(template(script)).not.toMatch(/^\s*(?:export\s+)?RALPH_MODEL=/m);
      expect(template(script)).not.toMatch(/RALPH_MODEL:-[^}]/);
    }
  });
});

describe("launch.sh refuses a start with no terminal", () => {
  it("refuses when stdin is not a terminal, with a model named, before anything else", () => {
    const result = runScript("launch.sh", { RALPH_MODEL: EXPLICIT_MODEL });
    expect(result.status).toBe(EXIT_REFUSED_LAUNCH);
    expect(result.stderr).toMatch(/has no terminal/);
    expect(templateFiles()).toEqual(FILES);
    expect(readdirSync(scratch)).toEqual([]);
  });

  it("checks for a terminal before the model, the tools or the repo", () => {
    const text = template("launch.sh");
    const terminal = text.indexOf("[ -t 0 ]");
    expect(terminal).toBeGreaterThan(0);
    for (const later of ["RALPH_MODEL:-", "command -v", "git -C", "mkdir", "nohup"]) {
      expect(text.indexOf(later)).toBeGreaterThan(terminal);
    }
  });
});

describe("theme-wave.json parses and every story names its file set", () => {
  const wave = JSON.parse(template("theme-wave.json")) as Wave;
  const stories = wave.userStories;

  it("names the theme by id and folder, and the branches", () => {
    expect(wave.themeId).toMatch(ID_PATTERN);
    expect(wave.themeDir).toMatch(THEME_DIR);
    for (const field of [wave.branchName, wave.baseBranch, wave.prBase]) expect(field.length).toBeGreaterThan(0);
  });

  it("has stories with different ids, a number priority, criteria, and none passing yet", () => {
    expect(stories.length).toBeGreaterThan(0);
    expect(new Set(stories.map((story) => story.id)).size).toBe(stories.length);
    for (const story of stories) {
      expect(typeof story.priority).toBe("number");
      expect(story.passes).toBe(false);
      expect(story.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });

  it.each(stories.map((story): [string, Story] => [story.id, story]))("%s lists its files, all under themeDir", (_id, story) => {
    expect(story.files.length).toBeGreaterThan(0);
    expect(story.files.filter((file) => !file.startsWith(`${wave.themeDir}/`) || file.split("/").includes(".."))).toEqual([]);
  });
});

describe("the prompts say CI is the test and name only what exists", () => {
  it("PROMPT_build.md says CI is the test, and that nothing runs in the session", () => {
    const text = template("PROMPT_build.md");
    expect(text).toMatch(/\bCI is the test\b/);
    expect(text).toMatch(/Nothing runs in this session/);
  });

  it.each(TEXT_FILES)("%s names only automatos-theme commands the CLI has built", (name) => {
    const commands = Array.from(template(name).matchAll(CLI_COMMAND), (match) => match[1]);
    expect(commands.filter((command) => !builtCommands.includes(command))).toEqual([]);
  });

  it.each(TEXT_FILES)("%s names only npm scripts the kit's root defines", (name) => {
    const scripts = Array.from(template(name).matchAll(NPM_SCRIPT), (match) => match[1] ?? match[2]);
    expect(scripts.filter((script) => !rootScripts.includes(script))).toEqual([]);
  });

  it.each(["PROMPT_build.md", "PROMPT_cifix.md"])("every placeholder of %s is one run.sh fills in", (name) => {
    const placeholders = Array.from(template(name).matchAll(PLACEHOLDER), (match) => match[1]);
    expect(placeholders).toContain("THEME_ID");
    expect(placeholders.filter((placeholder) => !template("run.sh").includes(`s#{{${placeholder}}}#`))).toEqual([]);
  });

  it("every sentinel the prompts end on is one run.sh reads", () => {
    const run = template("run.sh");
    for (const sentinel of BUILD_SENTINELS) {
      expect(template("PROMPT_build.md")).toContain(sentinel);
      expect(run).toContain(`"${sentinel}"`);
    }
    expect(template("PROMPT_cifix.md")).toContain(CIFIX_SENTINEL);
    expect(run).toContain(`"${CIFIX_SENTINEL}"`);
  });
});

describe("no template file names this repo, a local path, a planning file, a price or a person", () => {
  it.each(FILES)("%s", (name) => {
    const text = template(name);
    expect(FORBIDDEN_TEXT.filter((forbidden) => text.includes(forbidden))).toEqual([]);
    expect(FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(text)).map(String)).toEqual([]);
    if (TEXT_FILES.includes(name)) expect(text).not.toMatch(PRICE);
  });
});
