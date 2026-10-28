// PRD-261 B-06a: the proof run's settings (proof/run-settings.json), a template scripts/proof/launch.sh fills in. Its
// permission rules keep Claude Code's file tools inside the clone and deny the home folder, the web, node on its own,
// npm exec, npx -c, publishing, pushing, curl and wget, and allow Bash only the kit's commands, denying Edit on the
// clone's .claude/, .git/hooks/ and .git/config too; its sandbox holds Bash and every process it starts: on, refusing
// to start without it, with no retry outside it and no auto-allow, writing only the clone and npm's cache (never the
// settings, the hooks or the git config), reading nothing in the home folder, reaching only the npm registry. Then
// the launcher runs with bash (CI only): it refuses a --dest inside the home folder, gives the sandbox the node
// binary's own folder and its npm's (never the whole prefix) when node is installed under a known version-manager
// layout under the home folder, refuses the prefix otherwise with a warning, and refuses a template with a
// placeholder it doesn't fill. A plain dry run's filled-in settings are in tests/proof-launch.test.ts.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { BASE_TAG, PROOF_ID, ROOT, SLUG, commitFiles, git, gitEnv, sandbox, upstream } from "./support/proof-git.ts";

const SETTINGS = "proof/run-settings.json";
const LAUNCH = join(ROOT, "scripts/proof/launch.sh");
const MODEL = "claude-opus-5-5";
const SCRIPT_TIMEOUT_MS = 60_000;
const EXIT_REFUSED = 1;
const PLACEHOLDER = /\{\{([A-Z_]+)\}\}/g;
const TOOLCHAIN_BIN_PLACEHOLDER = "{{TOOLCHAIN_BIN}}";
const TOOLCHAIN_NPM_PLACEHOLDER = "{{TOOLCHAIN_NPM}}";
const HOME_REFUSAL = "put the clone outside your home folder, e.g. under /tmp, so the run's file rules can deny your home.";

interface Settings {
  readonly permissions: { readonly allow: readonly string[]; readonly deny: readonly string[] };
  readonly sandbox: {
    readonly enabled: boolean;
    readonly failIfUnavailable: boolean;
    readonly allowUnsandboxedCommands: boolean;
    readonly autoAllowBashIfSandboxed: boolean;
    readonly excludedCommands: readonly string[];
    readonly filesystem: Readonly<Record<string, readonly string[]>>;
    readonly network: { readonly allowedDomains: readonly string[]; readonly allowLocalBinding: boolean };
  };
}

const text = readFileSync(join(ROOT, SETTINGS), "utf8");
const template = JSON.parse(text) as Settings;
const { allow, deny } = template.permissions;

describe("proof/run-settings.json, the template", () => {
  it("allows Bash the kit's commands only: never node, npm or npx as a whole, nor Bash itself", () => {
    expect(allow.filter((rule) => rule.startsWith("Bash"))).toEqual([
      "Bash(npm ci)", "Bash(npm install)", "Bash(npm install *)", "Bash(npm run *)", "Bash(npm test)", "Bash(npm test *)",
      "Bash(npx automatos-theme *)", "Bash(git status *)", "Bash(git diff *)", "Bash(git add *)", "Bash(git commit *)",
      "Bash(git log *)",
    ]);
    ["Bash", "Bash(*)", "Bash(node *)", "Bash(npm *)", "Bash(npx *)"].forEach((rule) => expect(allow, rule).not.toContain(rule));
  });

  it("allows the file tools inside the clone only, by Read and Edit rules (Write and Glob path rules never match)", () => {
    expect(allow.filter((rule) => !rule.startsWith("Bash"))).toEqual(["Read(/{{CLONE}}/**)", "Edit(/{{CLONE}}/**)"]);
    ["Read", "Edit", "Write", "Glob", "Grep"].forEach((tool) => expect(allow, tool).not.toContain(tool));
    expect([...allow, ...deny].filter((rule) => /^(?:Write|Glob|NotebookEdit)\(/.test(rule))).toEqual([]);
  });

  it("denies node on its own, npm exec, npx -c, publishing, pushing, curl, wget, the web and the home folder", () => {
    ["Bash(node *)", "Bash(npm exec *)", "Bash(npm x *)", "Bash(npx -c *)", "Bash(npm publish *)", "Bash(git push *)",
      "Bash(curl *)", "Bash(wget *)", "WebFetch", "WebSearch", "Read(~/**)", "Edit(~/**)"]
      .forEach((rule) => expect(deny, rule).toContain(rule));
  });

  it("denies Edit on the clone's .claude/, .git/hooks/ and .git/config too, matching the sandbox's denyWrite", () => {
    ["Edit(/{{CLONE}}/.claude/**)", "Edit(/{{CLONE}}/.git/hooks/**)", "Edit(/{{CLONE}}/.git/config)"]
      .forEach((rule) => expect(deny, rule).toContain(rule));
  });

  it("turns the sandbox on for Bash: no start without it, no retry outside it, no command run for being sandboxed", () => {
    const { enabled, failIfUnavailable, allowUnsandboxedCommands, autoAllowBashIfSandboxed, excludedCommands } = template.sandbox;
    expect({ enabled, failIfUnavailable, allowUnsandboxedCommands, autoAllowBashIfSandboxed, excludedCommands }).toEqual({
      enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false, autoAllowBashIfSandboxed: false, excludedCommands: [],
    });
  });

  it("lets the sandbox write the clone and npm's cache but not the settings, hooks or git config, read nothing at home, and reach the npm registry only", () => {
    expect(template.sandbox.filesystem).toEqual({
      allowRead: [TOOLCHAIN_BIN_PLACEHOLDER, TOOLCHAIN_NPM_PLACEHOLDER],
      allowWrite: ["{{CLONE}}", "{{NPM_CACHE}}"],
      denyWrite: ["{{CLONE}}/.claude", "{{CLONE}}/.git/hooks", "{{CLONE}}/.git/config"],
      denyRead: ["~/"],
    });
    expect(template.sandbox.network).toEqual({ allowedDomains: ["registry.npmjs.org"], allowLocalBinding: true });
  });

  it("holds only the placeholders the launcher fills, node's prefix on one line the launcher can drop and leave JSON", () => {
    const names = new Set(Array.from(text.matchAll(PLACEHOLDER), (match) => match[1]));
    expect([...names].sort()).toEqual(["CLONE", "NPM_CACHE", "TOOLCHAIN_BIN", "TOOLCHAIN_NPM"]);
    const script = readFileSync(LAUNCH, "utf8");
    names.forEach((name) => expect(script).toContain(`{{${name}}}`));
    const dropped = JSON.parse(text.split("\n").filter((line) => !line.includes(TOOLCHAIN_BIN_PLACEHOLDER)).join("\n")) as Settings;
    expect(Object.keys(dropped.sandbox.filesystem).sort()).toEqual(["allowWrite", "denyRead", "denyWrite"]);
  });
});

describe("scripts/proof/launch.sh, the home folder and node's prefix", () => {
  const scratch = sandbox("proof-settings-");
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));
  const home = join(scratch, "home");
  const runFrom = join(scratch, "run");
  const proofs = join(scratch, "proofs");
  [home, runFrom, proofs].forEach((folder) => mkdirSync(folder, { recursive: true }));
  const brief = join(scratch, "brief.md");
  writeFileSync(brief, "# Brief: Harbour\n");

  /** A --dry-run of the launcher with bash, its home folder the sandbox's `home`, plus `env`. */
  function launch(dest: string, env: Readonly<Record<string, string>> = {}): SpawnSyncReturns<string> {
    const args = ["--id", PROOF_ID, "--slug", SLUG, "--brief", brief, "--model", MODEL, "--dest", dest, "--dry-run"];
    return spawnSync("bash", [LAUNCH, ...args], {
      cwd: runFrom, env: { ...gitEnv(home), ...env }, input: "", encoding: "utf8", timeout: SCRIPT_TIMEOUT_MS,
    });
  }

  const settingsOf = (dest: string): Settings => JSON.parse(readFileSync(join(dest, ".claude", "settings.json"), "utf8")) as Settings;

  it("refuses a --dest inside the home folder, saying where to put it, and writes nothing", () => {
    mkdirSync(join(home, "proofs"), { recursive: true });
    const dest = join(home, "proofs", `${PROOF_ID}-${SLUG}`);
    const refused = launch(dest);
    expect(refused.status).toBe(EXIT_REFUSED);
    expect(refused.stderr).toContain(HOME_REFUSAL);
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(`${dest}.npm-cache`)).toBe(false);
  });

  it("gives the sandbox only the node binary's folder and its npm's to read, never the whole prefix, for a known nvm layout under the home folder", () => {
    const prefix = join(home, ".nvm", "versions", "node", "v0");
    mkdirSync(join(prefix, "bin"), { recursive: true });
    writeFileSync(join(prefix, "bin", "node"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(prefix, "bin", "node"), 0o755);
    const dest = join(proofs, "toolchain");
    const kitUrl = pathToFileURL(upstream(scratch)).href;
    const ran = launch(dest, { PROOF_KIT_URL: kitUrl, PATH: `${join(prefix, "bin")}:${process.env.PATH ?? ""}` });
    expect(ran.status, `${ran.stdout}${ran.stderr}`).toBe(0);
    const realPrefix = realpathSync(prefix);
    expect(settingsOf(dest).sandbox.filesystem.allowRead).toEqual([
      join(realPrefix, "bin"), join(realPrefix, "lib", "node_modules", "npm"),
    ]);
  });

  it("refuses the toolchain, with no allowRead at all, when node's prefix is the home folder itself", () => {
    const binDir = join(home, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "node"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(binDir, "node"), 0o755);
    const dest = join(proofs, "toolchain-home");
    const kitUrl = pathToFileURL(upstream(scratch)).href;
    const ran = launch(dest, { PROOF_KIT_URL: kitUrl, PATH: `${binDir}:${process.env.PATH ?? ""}` });
    expect(ran.status, `${ran.stdout}${ran.stderr}`).toBe(0);
    expect(ran.stderr).toContain("node's install prefix is the home folder itself");
    expect(settingsOf(dest).sandbox.filesystem.allowRead).toBeUndefined();
  });

  it("refuses the toolchain, with a warning, when node's prefix is under the home folder but not a known version-manager layout", () => {
    const prefix = join(home, "toolchains", "node-custom");
    mkdirSync(join(prefix, "bin"), { recursive: true });
    writeFileSync(join(prefix, "bin", "node"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(prefix, "bin", "node"), 0o755);
    const dest = join(proofs, "toolchain-unknown");
    const kitUrl = pathToFileURL(upstream(scratch)).href;
    const ran = launch(dest, { PROOF_KIT_URL: kitUrl, PATH: `${join(prefix, "bin")}:${process.env.PATH ?? ""}` });
    expect(ran.status, `${ran.stdout}${ran.stderr}`).toBe(0);
    expect(ran.stderr).toContain("not a known version-manager layout");
    expect(settingsOf(dest).sandbox.filesystem.allowRead).toBeUndefined();
  });

  it("refuses a base whose settings hold a placeholder the launcher doesn't fill", () => {
    const kit = upstream(scratch);
    commitFiles(kit, { [SETTINGS]: text.replace('"enabled": true,', '"enabled": true, "note": "{{UNKNOWN}}",') }, scratch);
    git(kit, ["tag", "-f", BASE_TAG], scratch);
    const refused = launch(join(proofs, "placeholder"), { PROOF_KIT_URL: pathToFileURL(kit).href });
    expect(refused.status).toBe(EXIT_REFUSED);
    expect(refused.stderr).toContain(`${SETTINGS} has a placeholder the launcher does not fill.`);
  });
});
