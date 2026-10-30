// PRD-261 C-06a: theme-release.yml, read as a file, with its bash steps that need no network run as the runner's
// bash runs them. A tag a person pushes, <slug>-v<v>, releases the theme in themes/<slug>, unlisted and unsigned:
// the tag rule is the one theme-publish.yml's backfill holds a tag to (scripts/release/bumped.mjs --tag), so any
// listed publisher's theme releases the same way, Play, HUD, Arcade and Candy among them. The envelope-PR signature
// job is gone: the publish run signs and attaches a .sig.json (tests/theme-publish.test.ts).
import { spawnSync } from "node:child_process";
import { devNull, tmpdir } from "node:os";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { MANIFEST_SUFFIX, PACKAGE_EXTENSION, packageBaseName } from "../packages/theme-cli/src/pack.ts";
import { packageNameOf } from "../scripts/release/themes.mjs";
import { ROOT, blockOf, codeOf, envOf, expectInOrder, jobOf, readText, stepNamed, stepsOf, trackedFiles, usesLines } from "./support/workflow-steps.ts";

const RELEASE = ".github/workflows/theme-release.yml";
const PUBLISH = ".github/workflows/theme-publish.yml";
const KIT = ".github/workflows/kit.yml";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
/** The kit's released themes, each by its tag's slug, with theme.json's name. */
const RELEASED = [
  { slug: "play", name: "Play" }, { slug: "hud", name: "HUD" }, { slug: "arcade", name: "Arcade" }, { slug: "candy", name: "Candy" },
] as const;
const WORKFLOW_ENV = ["THEMES_DIR", "PACK_FOLDER", "SIGNATURES_FOLDER", "KEYS_FILE", "TAG_PATTERN"];
const VERIFY_RUN = 'node scripts/sign/verify.ts "$PACK_DIR/$PACKAGE_NAME-$VERSION.autotheme" "$SIGNATURE" "$KEYS"';
/** The release scripts the tag check runs, copied into a throwaway repository to run it there. */
const TAG_SCRIPTS = ["scripts/release/bumped.mjs", "scripts/release/themes.mjs"];

const text = readText(RELEASE);
const release = stepsOf(jobOf(text, "release"));
const sandbox = mkdtempSync(join(tmpdir(), "theme-release-"));
const PATH = `${dirname(process.execPath)}:${process.env.PATH ?? ""}`;
const GIT_ENV = {
  HOME: sandbox, LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull, GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "Kit Test", GIT_AUTHOR_EMAIL: "kit-test@example.com",
  GIT_COMMITTER_NAME: "Kit Test", GIT_COMMITTER_EMAIL: "kit-test@example.com",
};

interface Ran {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** What the script wrote to $GITHUB_ENV, by name. */
  readonly written: Readonly<Record<string, string>>;
}

/** The workflow's env block, as the runner hands it to every step. */
function workflowEnv(): Record<string, string> {
  return Object.fromEntries(WORKFLOW_ENV.map((name) => [name, envOf(text, name)]));
}

/** A step's script, run as the runner's bash runs it, with the workflow's env, `env` and a $GITHUB_ENV file. */
function runStep(script: string, env: Readonly<Record<string, string>>, cwd: string = ROOT): Ran {
  const temp = mkdtempSync(join(sandbox, "env-"));
  const file = join(temp, "github-env");
  writeFileSync(file, "");
  const run = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd, encoding: "utf8", env: { PATH, ...workflowEnv(), GITHUB_ENV: file, RUNNER_TEMP: temp, ...env },
  });
  const lines = readFileSync(file, "utf8").split("\n").filter((line) => line !== "");
  const written = Object.fromEntries(lines.map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, written };
}

const nameTheme = (tag: string): Readonly<Record<string, string>> => runStep(stepNamed(release, "Name the theme").run, { TAG: tag }).written;

function git(cwd: string, args: readonly string[]): string {
  const run = spawnSync("git", args, { cwd, env: { PATH, ...GIT_ENV }, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout.trim();
}

/** A clone, as the release job checks it out, of an upstream on main holding the release scripts and `files`, tagged `tag`. */
function taggedClone(tag: string, files: Readonly<Record<string, string>>): string {
  const repo = mkdtempSync(join(sandbox, "repo-"));
  git(repo, ["init", "-q", "-b", "main"]);
  TAG_SCRIPTS.forEach((rel) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    copyFileSync(join(ROOT, rel), join(repo, rel));
  });
  Object.entries(files).forEach(([rel, body]) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), body);
  });
  git(repo, ["add", "--", ...TAG_SCRIPTS, ...Object.keys(files)]);
  git(repo, ["commit", "-q", "-m", "theme"]);
  git(repo, ["tag", tag]);
  const clone = mkdtempSync(join(sandbox, "clone-"));
  git(sandbox, ["clone", "-q", pathToFileURL(repo).href, clone]);
  git(clone, ["checkout", "-q", "--detach", `refs/tags/${tag}`]);
  return clone;
}

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe("theme-release.yml (C-06a): the workflow", () => {
  it("runs on a pushed tag that looks like <slug>-v<version>, and on nothing else", () => {
    const on = blockOf(text, "on");
    expect(on.match(/^ {2}\S+:$/gm)).toEqual(["  push:"]);
    expect(on).toContain('\n  push:\n    tags: ["*-v*"]\n');
    expect(on).not.toMatch(/branches:|paths:|workflow_dispatch|inputs:/);
    expect(jobOf(text, "release")).toContain("\n    if: github.event_name == 'push' && github.ref_type == 'tag'\n");
  });

  it("holds the tag rule scripts/release/themes.mjs holds, in the shell's spelling", () => {
    expect(envOf(text, "TAG_PATTERN")).toBe("^([a-z0-9-]+)-v[0-9]+\\.[0-9]+\\.[0-9]+$");
  });

  it("has one job, with contents: write only, reads no secrets, gives gh alone the job's token, and pins actions as kit.yml", () => {
    expect(blockOf(text, "jobs").match(/^ {2}\S+:$/gm)).toEqual(["  release:"]);
    expect(text.match(/^ *permissions:.*$/gm)).toEqual(["permissions: {}", "    permissions:"]);
    expect(jobOf(text, "release")).toMatch(/\n {4}permissions:\n {6}contents: write\n {4}\S/);
    expect(text).not.toMatch(/\bsecrets\./);
    expect(release.filter((step) => step.body.includes("github.token")).map((step) => step.name)).toEqual(["Publish the release"]);
    expect(stepNamed(release, "Publish the release").body).toMatch(/\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n[^]*\bgh release create /);
    expect(usesLines(text).filter((line) => !PINNED_ACTION.test(line) || !readText(KIT).includes(`\n${line}\n`))).toEqual([]);
    expect(text.match(/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false\n\s+fetch-depth: 0\n/g)).toHaveLength(1);
    release.forEach((step) => expect(step.run, step.name).not.toContain("${{"));
  });

  it("installs and builds as kit.yml does, and packs and checksums the theme as the publish run's build does", () => {
    ["Set up Node", "Pin npm", "Build"].forEach((name) => expect(codeOf(stepNamed(release, name))).toBe(codeOf(stepNamed(stepsOf(readText(KIT)), name))));
    const build = stepsOf(jobOf(readText(PUBLISH), "build"));
    ["Install (from the lockfile)", "Pack the theme", "Checksum"].forEach((name) => expect(codeOf(stepNamed(release, name)), name).toBe(codeOf(stepNamed(build, name))));
    expect(stepNamed(release, "Install (from the lockfile)").run).toBe("npm ci --ignore-scripts --no-audit --no-fund");
    expect(stepNamed(release, "Pack the theme").run).toBe('npm run pack --workspace "$THEME_DIR"');
    [`sha256sum "$base${PACKAGE_EXTENSION}" > "$base${PACKAGE_EXTENSION}.sha256"`, `"$base${MANIFEST_SUFFIX}"`, '"$actual" != "$(summary zipSha256)"']
      .forEach((part) => expect(stepNamed(release, "Checksum").run).toContain(part));
    expect(stepNamed(release, "Check the theme at the tag").run).toContain('node scripts/release/bumped.mjs --tag "$TAG" > "$RUNNER_TEMP/theme.json"');
  });

  it("releases a tag on main naming theme.json's version, a signature at it once verified", () => {
    expect(stepNamed(release, "Check the tag").body).toContain("\n          TAG: ${{ github.ref_name }}\n");
    expect(stepNamed(release, "Find a signature at the tag").body).toContain("\n        id: signature\n");
    expectInOrder(release, ["Check the tag", "Name the theme", "Check the theme at the tag", "Install (from the lockfile)", "Pack the theme",
      "Checksum", "Find a signature at the tag", "Check a signing key is published", "Verify the signature", "Publish the release"]);
    const gate = "\n        if: steps.signature.outputs.found == 'true'\n";
    ["Check a signing key is published", "Verify the signature"].forEach((name) => expect(stepNamed(release, name).body).toContain(gate));
    expect(stepNamed(release, "Verify the signature").run).toBe(VERIFY_RUN);
    ['assets=("$base.autotheme" "$base.autotheme.sha256")', 'gh release create "$TAG" "${assets[@]}" --verify-tag --title "$title" --notes "$notes"',
      'notes="$title. A local edition installs it with Settings › Appearance › Themes › Install theme.']
      .forEach((part) => expect(stepNamed(release, "Publish the release").run).toContain(part));
  });
});

describe("theme-release.yml (C-06a): each theme from its tag", () => {
  it.each<[string, number, Readonly<Record<string, string>>]>([
    ["play-v1.1.1", 0, { TAG: "play-v1.1.1", VERSION: "1.1.1" }], ["hud-v1.0.0", 0, { TAG: "hud-v1.0.0", VERSION: "1.0.0" }],
    ["hud-v10.0.12", 0, { TAG: "hud-v10.0.12", VERSION: "10.0.12" }], ["arcade-v1.0.0", 0, { TAG: "arcade-v1.0.0", VERSION: "1.0.0" }],
    ["arcade-v0.1.0", 0, { TAG: "arcade-v0.1.0", VERSION: "0.1.0" }], ["nav-vibe-v2.0.0", 0, { TAG: "nav-vibe-v2.0.0", VERSION: "2.0.0" }],
    ["candy-v1.0.0", 0, { TAG: "candy-v1.0.0", VERSION: "1.0.0" }],
    ["hud-v1.0", 1, {}], ["hud-v1.0.0-rc.1", 1, {}],
    ["v1.0.0", 1, {}], ["Hud-v1.0.0", 1, {}], ["hud_x-v1.0.0", 1, {}], ["hud-v1.0.0\n", 1, {}], ["kit-b06-base", 1, {}],
  ])("Check the tag takes %j: exit %i, writing the tag and its version", (tag, status, written) => {
    const ran = runStep(stepNamed(release, "Check the tag").run, { TAG: tag });
    expect([ran.status, ran.written, ran.stderr]).toEqual([status, written, ""]);
    if (status !== 0) expect(ran.stdout).toMatch(/^::error::A release tag is <slug>-v<major>\.<minor>\.<patch>/m);
  });

  it("names Play's folder, pack folder and signatures as the workflow held them, and a slug with -v in it whole", () => {
    expect(nameTheme("play-v1.1.1")).toEqual({
      THEME: "play", THEME_DIR: "themes/play", PACK_DIR: "themes/play/out", SIGNATURES_DIR: "themes/play/signatures",
    });
    expect(nameTheme("nav-vibe-v2.0.0")).toMatchObject({ THEME: "nav-vibe", THEME_DIR: "themes/nav-vibe" });
  });

  it.each(RELEASED)("finds $slug's package where its pack writes it, by its id, its signatures in a folder no package holds", ({ slug }) => {
    const vars = nameTheme(`${slug}-v1.0.0`);
    const manifest = JSON.parse(readText(`${vars.THEME_DIR}/theme.json`)) as { id: string; version: string };
    const pack = (JSON.parse(readText(`${vars.THEME_DIR}/package.json`)) as { scripts: Record<string, string> }).scripts.pack;
    expect(vars).toMatchObject({ THEME: slug, THEME_DIR: `themes/${slug}`, PACK_DIR: `themes/${slug}/out` });
    expect(manifest.id).toBe(`automatos/${slug}`);
    expect(pack).toMatch(new RegExp(`(?:^|&& )automatos-theme pack \\. --out ${envOf(text, "PACK_FOLDER")}$`));
    expect(`${packageNameOf(manifest.id)}-${manifest.version}`).toBe(packageBaseName(manifest.id, manifest.version));
    expect(trackedFiles()).toContain(`${vars.SIGNATURES_DIR}/.gitkeep`);
    expect([...PACKED_FOLDERS, ...PACKED_TOP_FILES]).not.toContain(envOf(text, "SIGNATURES_FOLDER"));
  });

  it("checks the theme at the tag with bumped.mjs --tag: any listed publisher's <publisher>/<slug>, its package named by its id", () => {
    const files = {
      "release/publishers.json": '{"publishers":["automatos","pixelcade"]}\n',
      "themes/arcade/theme.json": '{"schema":"automatos-theme/v1","id":"pixelcade/arcade","version":"0.1.0"}\n',
    };
    const check = stepNamed(release, "Check the theme at the tag").run;
    const listed = runStep(check, { ...GIT_ENV, TAG: "arcade-v0.1.0" }, taggedClone("arcade-v0.1.0", files));
    expect([listed.status, listed.written]).toEqual([0, { PACKAGE_NAME: "pixelcade.arcade" }]);
    const unlisted = { ...files, "release/publishers.json": '{"publishers":["automatos"]}\n' };
    const refused = runStep(check, { ...GIT_ENV, TAG: "arcade-v0.1.0" }, taggedClone("arcade-v0.1.0", unlisted));
    expect([refused.status, refused.written]).toEqual([1, {}]);
    expect(refused.stderr).toMatch(/^::error::bumped: arcade-v0\.1\.0 can't be released: pixelcade\/arcade: pixelcade isn't in release\/publishers\.json/m);
  });

  it.each(RELEASED)("titles $slug's release with theme.json's name and the version ($name)", ({ slug, name }) => {
    const line = stepNamed(release, "Publish the release").run.split("\n").map((item) => item.trim()).find((item) => item.startsWith("title="));
    const ran = runStep(`${line ?? "exit 3"}\nprintf '%s' "$title"`, { THEME_DIR: `themes/${slug}`, VERSION: "9.9.9" });
    expect([ran.status, ran.stdout]).toEqual([0, `${name} 9.9.9`]);
  });

  const keysPath = join(sandbox, "keys.json");
  const keys = (...statuses: string[]): string =>
    JSON.stringify({ schema: 1, keys: statuses.map((status) => ({ keyId: "ed25519:0123456789abcdef", spki: "AAAA", status, added: "2026-10-20" })) });

  it.each<[string, number, string, RegExp]>([
    ["no key", 1, keys(), /^::error::No signing key yet: keys\/theme-signing\.json holds no active key/m],
    ["no active key", 1, keys("retired", "revoked"), /^::error::No signing key yet: /m],
    ["a file that isn't a keys file", 1, "{", /^::error::keys\/theme-signing\.json can't be read as a keys file/m],
    ["an active key", 0, keys("active"), /^keys\/theme-signing\.json holds 1 active signing key\(s\)\.$/m],
    ["the shipped file, Automatos's theme-signing key", 0, readText("keys/theme-signing.json"), /^keys\/theme-signing\.json holds 1 active signing key\(s\)\.$/m],
  ])("the key check, run as the runner's bash runs it, on %s: exit %i with one plain line, never a stack trace", (_, status, keysText, line) => {
    writeFileSync(keysPath, keysText);
    const ran = runStep(stepNamed(release, "Check a signing key is published").run, { KEYS: keysPath });
    expect([ran.status, ran.stderr]).toEqual([status, ""]);
    expect(ran.stdout).toMatch(line);
  });
});
