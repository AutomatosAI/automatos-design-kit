// PRD-261 C-06a: theme-release.yml, read as a file, with its bash steps that need no network run as the runner's
// bash runs them. A play-v<v> tag releases Play and a hud-v<v> tag HUD, the same way: the theme is the tag's slug,
// and every name the job uses is made from it, so Play's names are the ones the workflow held before HUD
// (themes/play, themes/play/out, automatos.play, themes/play/signatures). Moved out of tests/theme-workflows.test.ts,
// which keeps the review and sign workflows, to hold both themes under the 400-line cap.
import { spawnSync } from "node:child_process";
import { devNull, tmpdir } from "node:os";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { MANIFEST_SUFFIX, PACKAGE_EXTENSION, packageBaseName } from "../packages/theme-cli/src/pack.ts";
import {
  ROOT, blockOf, codeOf, envOf, expectInOrder, jobOf, readText, stepNamed, stepsOf, trackedFiles, usesLines,
} from "./support/workflow-steps.ts";

const RELEASE = ".github/workflows/theme-release.yml";
const KIT = ".github/workflows/kit.yml";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
/** The themes this workflow releases, each by its tag's slug, with theme.json's name. */
const RELEASED = [{ slug: "play", name: "Play" }, { slug: "hud", name: "HUD" }] as const;
const WORKFLOW_ENV = ["THEMES_DIR", "PACK_FOLDER", "SIGNATURES_FOLDER", "KEYS_FILE", "TAG_PATTERN"];
const SHARED_STEPS = [
  "Set up Node", "Pin npm", "Name the theme", "Check the theme at the tag", "Install (from the lockfile)", "Build",
  "Pack the theme", "Checksum",
];
const VERIFY_RUN = 'node scripts/sign/verify.ts "$PACK_DIR/$PACKAGE_NAME-$VERSION.autotheme" "$SIGNATURE" "$KEYS"';

const text = readText(RELEASE);
const [release, signature] = ["release", "signature"].map((job) => stepsOf(jobOf(text, job)));
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
  const file = join(mkdtempSync(join(sandbox, "env-")), "github-env");
  writeFileSync(file, "");
  const run = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd, encoding: "utf8", env: { PATH, ...workflowEnv(), GITHUB_ENV: file, ...env },
  });
  const lines = readFileSync(file, "utf8").split("\n").filter((line) => line !== "");
  const written = Object.fromEntries(lines.map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, written };
}

function nameTheme(tag: string): Readonly<Record<string, string>> {
  return runStep(stepNamed(release, "Name the theme").run, { TAG: tag }).written;
}

function git(cwd: string, args: readonly string[]): string {
  const run = spawnSync("git", args, { cwd, env: { PATH, ...GIT_ENV }, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout.trim();
}

/** A repository whose first commit holds a README, tagged `tag`, then a commit adding `added`; its first commit's id. */
function signedRepo(tag: string, added: readonly string[]): { readonly repo: string; readonly before: string } {
  const repo = mkdtempSync(join(sandbox, "repo-"));
  git(repo, ["init", "-q", "-b", "main"]);
  writeFileSync(join(repo, "README.md"), "# kit\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-q", "-m", "first"]);
  git(repo, ["tag", tag]);
  added.forEach((rel) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), "{}\n");
  });
  git(repo, ["add", "--", ...added]);
  git(repo, ["commit", "-q", "-m", "signatures"]);
  return { repo, before: git(repo, ["rev-list", "--max-parents=0", "HEAD"]) };
}

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe("theme-release.yml (C-06a): the workflow", () => {
  it("runs on a play-v or hud-v tag, on a push to main that changes a theme's signature, and by hand with one tag", () => {
    const on = blockOf(text, "on");
    const signatures = `${envOf(text, "THEMES_DIR")}/*/${envOf(text, "SIGNATURES_FOLDER")}/*.sig.json`;
    const tags = RELEASED.map(({ slug }) => `"${slug}-v*"`).join(", ");
    expect([on.match(/^ {2}\S+:$/gm), on.match(/^ {6}\S+:$/gm)]).toEqual([["  push:", "  workflow_dispatch:"], ["      tag:"]]);
    expect(on).toContain(`\n    branches: [main]\n    tags: [${tags}]\n    paths: ["${signatures}"]\n`);
    expect(jobOf(text, "release")).toContain("\n    if: github.event_name == 'push' && github.ref_type == 'tag'\n");
    expect(jobOf(text, "signature")).toContain("\n    if: github.ref == 'refs/heads/main'\n");
  });

  it("gives each job contents: write only, reads no secrets, gives gh alone the job's token, and pins actions as kit.yml", () => {
    expect(blockOf(text, "jobs").match(/^ {2}\S+:$/gm)).toEqual(["  release:", "  signature:"]);
    expect(text.match(/^ *permissions:.*$/gm)).toEqual(["permissions: {}", "    permissions:", "    permissions:"]);
    ["release", "signature"].forEach((job) => expect(jobOf(text, job)).toMatch(/\n {4}permissions:\n {6}contents: write\n {4}\S/));
    expect(text).not.toMatch(/\bsecrets\./);
    const holders = [...release, ...signature].filter((step) => step.body.includes("github.token"));
    expect(holders.map((step) => step.name)).toEqual(["Publish the release", "Attach the signature"]);
    holders.forEach((step) => expect(step.body).toMatch(/\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n[^]*\bgh release (?:create|upload) /));
    expect(usesLines(text).filter((line) => !PINNED_ACTION.test(line) || !readText(KIT).includes(`\n${line}\n`))).toEqual([]);
    expect(text.match(/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false\n\s+fetch-depth: 0\n/g)).toHaveLength(2);
    [...release, ...signature].forEach((step) => expect(step.run, step.name).not.toContain("${{"));
  });

  it("installs and builds as kit.yml does, and names, checks, packs and checksums the theme alike in both jobs", () => {
    ["Set up Node", "Pin npm", "Build"].forEach((name) => expect(codeOf(stepNamed(release, name))).toBe(codeOf(stepNamed(stepsOf(readText(KIT)), name))));
    SHARED_STEPS.forEach((name) => expect(codeOf(stepNamed(signature, name)), name).toBe(codeOf(stepNamed(release, name))));
    expect(stepNamed(signature, "Check a signing key is published").run).toBe(stepNamed(release, "Check a signing key is published").run);
    expect(stepNamed(release, "Install (from the lockfile)").run).toBe("npm ci --ignore-scripts --no-audit --no-fund");
    expect(stepNamed(release, "Pack the theme").run).toBe('npm run pack --workspace "$THEME_DIR"');
    [`sha256sum "$base${PACKAGE_EXTENSION}" > "$base${PACKAGE_EXTENSION}.sha256"`, `"$base${MANIFEST_SUFFIX}"`, '"$actual" != "$(summary zipSha256)"']
      .forEach((part) => expect(stepNamed(release, "Checksum").run).toContain(part));
    const check = stepNamed(release, "Check the theme at the tag").run;
    ['"$(field id)" != "automatos/$THEME"', "git merge-base --is-ancestor HEAD refs/remotes/origin/main", '"$version" != "$VERSION"']
      .forEach((part) => expect(check).toContain(part));
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

  it("attaches a signature named by the tag input or the one changed file, from main's files, to the TAGGED build", () => {
    expect(stepNamed(signature, "Find the tag").body).toContain("\n          TAG_INPUT: ${{ inputs.tag }}\n          BEFORE: ${{ github.event.before }}\n");
    expectInOrder(signature, ["Find the tag", "Name the theme", "Keep the envelope and the keys", "Check a signing key is published",
      "Check out the tagged commit", "Check the theme at the tag", "Install (from the lockfile)", "Build", "Pack the theme",
      "Verify the signature", "Attach the signature"]);
    expect(stepNamed(signature, "Keep the envelope and the keys").run).toMatch(/cp "\$sig" [^\n]*\n\s*cp "\$KEYS_FILE" /);
    expect(stepNamed(signature, "Check out the tagged commit").run).toBe('git checkout --quiet --detach "refs/tags/$TAG"');
    expect(["Verify the signature", "Attach the signature"].map((name) => stepNamed(signature, name).run))
      .toEqual([VERIFY_RUN, 'gh release upload "$TAG" "$SIGNATURE" --clobber']);
  });
});

describe("theme-release.yml (C-06a): each theme from its tag", () => {
  it.each<[string, number, Readonly<Record<string, string>>]>([
    ["play-v1.1.1", 0, { TAG: "play-v1.1.1", VERSION: "1.1.1" }], ["hud-v1.0.0", 0, { TAG: "hud-v1.0.0", VERSION: "1.0.0" }],
    ["hud-v10.0.12", 0, { TAG: "hud-v10.0.12", VERSION: "10.0.12" }], ["hud-v1.0", 1, {}], ["hud-v1.0.0-rc.1", 1, {}],
    ["v1.0.0", 1, {}], ["xhud-v1.0.0", 1, {}], ["other-v1.0.0", 1, {}], ["hud-v1.0.0\n", 1, {}],
  ])("Check the tag takes %j: exit %i, writing the tag and its version", (tag, status, written) => {
    const ran = runStep(stepNamed(release, "Check the tag").run, { TAG: tag });
    expect([ran.status, ran.written, ran.stderr]).toEqual([status, written, ""]);
    if (status !== 0) expect(ran.stdout).toMatch(/^::error::A release tag is <theme>-v<major>\.<minor>\.<patch>/m);
  });

  it("names Play's folder, pack folder, package and signatures as the workflow held them before HUD", () => {
    expect(nameTheme("play-v1.1.1")).toEqual({
      THEME: "play", THEME_DIR: "themes/play", PACK_DIR: "themes/play/out", PACKAGE_NAME: "automatos.play", SIGNATURES_DIR: "themes/play/signatures",
    });
  });

  it.each(RELEASED)("finds $slug's package where its pack writes it, by its id, its signatures in a folder no package holds", ({ slug }) => {
    const vars = nameTheme(`${slug}-v1.0.0`);
    const manifest = JSON.parse(readText(`${vars.THEME_DIR}/theme.json`)) as { id: string; version: string };
    const pack = (JSON.parse(readText(`${vars.THEME_DIR}/package.json`)) as { scripts: Record<string, string> }).scripts.pack;
    expect(vars).toMatchObject({ THEME: slug, THEME_DIR: `themes/${slug}`, PACK_DIR: `themes/${slug}/out` });
    expect(manifest.id).toBe(`automatos/${slug}`);
    expect(pack).toMatch(new RegExp(`(?:^|&& )automatos-theme pack \\. --out ${envOf(text, "PACK_FOLDER")}$`));
    expect(`${vars.PACKAGE_NAME}-${manifest.version}`).toBe(packageBaseName(manifest.id, manifest.version));
    expect(trackedFiles()).toContain(`${vars.SIGNATURES_DIR}/.gitkeep`);
    expect([...PACKED_FOLDERS, ...PACKED_TOP_FILES]).not.toContain(envOf(text, "SIGNATURES_FOLDER"));
  });

  it.each(RELEASED)("titles $slug's release with theme.json's name and the version ($name)", ({ slug, name }) => {
    const line = stepNamed(release, "Publish the release").run.split("\n").map((item) => item.trim()).find((item) => item.startsWith("title="));
    const ran = runStep(`${line ?? "exit 3"}\nprintf '%s' "$title"`, { THEME_DIR: `themes/${slug}`, VERSION: "9.9.9" });
    expect([ran.status, ran.stdout]).toEqual([0, `${name} 9.9.9`]);
  });

  it.each(RELEASED)("Find the tag takes $slug's tag by hand, and from the one signature a push to main added", ({ slug }) => {
    const tag = `${slug}-v1.2.3`;
    const { repo, before } = signedRepo(tag, [`themes/${slug}/signatures/1.2.3.sig.json`]);
    const find = stepNamed(signature, "Find the tag").run;
    const byHand = runStep(find, { ...GIT_ENV, GITHUB_EVENT_NAME: "workflow_dispatch", TAG_INPUT: tag, BEFORE: "" }, repo);
    const pushed = runStep(find, { ...GIT_ENV, GITHUB_EVENT_NAME: "push", TAG_INPUT: "", BEFORE: before }, repo);
    [byHand, pushed].forEach((ran) => expect([ran.status, ran.written]).toEqual([0, { TAG: tag, VERSION: "1.2.3" }]));
  });

  it.each<[string, readonly string[], RegExp]>([
    ["two signatures", ["themes/play/signatures/1.2.3.sig.json", "themes/hud/signatures/1.2.3.sig.json"], /^::error::A push attaches exactly one /m],
    ["a theme TAG_PATTERN doesn't name", ["themes/other/signatures/1.2.3.sig.json"], /^::error::The tag must be <theme>-v/m],
    ["a file deeper than a theme's signatures", ["themes/hud/x/signatures/1.2.3.sig.json"], /^::error::A push attaches exactly one /m],
  ])("Find the tag refuses a push with %s", (_, added, error) => {
    const { repo, before } = signedRepo("hud-v1.2.3", added);
    const ran = runStep(stepNamed(signature, "Find the tag").run, { ...GIT_ENV, GITHUB_EVENT_NAME: "push", TAG_INPUT: "", BEFORE: before }, repo);
    expect([ran.status, ran.written]).toEqual([1, {}]);
    expect(ran.stdout).toMatch(error);
  });

  const keysPath = join(sandbox, "keys.json");
  const keys = (...statuses: string[]): string =>
    JSON.stringify({ schema: 1, keys: statuses.map((status) => ({ keyId: "ed25519:0123456789abcdef", spki: "AAAA", status, added: "2026-10-20" })) });

  it.each<[string, number, string, RegExp]>([
    ["no key, as the file ships until the production key", 1, keys(), /^::error::No signing key yet: keys\/theme-signing\.json holds no active key/m],
    ["no active key", 1, keys("retired", "revoked"), /^::error::No signing key yet: /m],
    ["a file that isn't a keys file", 1, "{", /^::error::keys\/theme-signing\.json can't be read as a keys file/m],
    ["an active key", 0, keys("active"), /^keys\/theme-signing\.json holds 1 active signing key\(s\)\.$/m],
  ])("the key check, run as the runner's bash runs it, on %s: exit %i with one plain line, never a stack trace", (_, status, keysText, line) => {
    writeFileSync(keysPath, keysText);
    const ran = runStep(stepNamed(release, "Check a signing key is published").run, { KEYS: keysPath });
    expect([ran.status, ran.stderr]).toEqual([status, ""]);
    expect(ran.stdout).toMatch(line);
  });
});
