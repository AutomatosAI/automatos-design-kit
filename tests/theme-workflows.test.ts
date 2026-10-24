// PRD-261 C-02b and C-03a (D3, 19 Oct): the two person-run workflows, read as files.
// theme-review.yml holds no secret, its token has no permissions, and every step after the
// install runs in `docker run --network none`. theme-sign.yml reads one secret,
// THEME_SIGNING_KEY, in its signing step only, and installs nothing. Nothing is run here. C-05m
// adds the verify script and the key id and envelope the sign step prints; no private key is
// committed anywhere. C-06a adds theme-release.yml; its key check is the one script run here (bash).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { MANIFEST_SUFFIX, PACKAGE_EXTENSION, packageBaseName } from "../packages/theme-cli/src/pack.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKFLOWS = ".github/workflows";
const REVIEW = `${WORKFLOWS}/theme-review.yml`;
const SIGN = `${WORKFLOWS}/theme-sign.yml`;
const RELEASE = `${WORKFLOWS}/theme-release.yml`;
const KIT = `${WORKFLOWS}/kit.yml`;
const LISTING = "docs/OFFICIAL-LISTING.md";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
const OTHER_TRIGGERS = /^ {2}(?:push|pull_request|pull_request_target|schedule|workflow_run|workflow_call|repository_dispatch|issue_comment):/m;
const SIGNING_SECRET = "secrets.THEME_SIGNING_KEY";
/** A PEM private key's armour label, built so that this file doesn't spell it out. */
const PEM_PRIVATE_LABEL = ["PRIVATE", "KEY"].join(" ");
const SIGN_SCRIPTS = [
  "scripts/sign/cli.ts", "scripts/sign/sign.ts", "scripts/sign/request.ts", "scripts/sign/envelope.ts",
  "scripts/sign/verify.ts", "packages/theme-cli/src/digest.ts", "packages/theme-cli/src/zip.ts",
];

interface Step {
  readonly name: string;
  readonly body: string;
  /** The `run:` script, without the key; empty for a `uses:` step. */
  readonly run: string;
}

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** The script under a step's `run:` key: the inline value or the indented block after it. */
function runOf(lines: readonly string[]): string {
  const at = lines.findIndex((line) => /^\s*run:/.test(line));
  if (at < 0) return "";
  const indent = (lines[at].match(/^\s*/) ?? [""])[0].length;
  const inline = lines[at].replace(/^\s*run:\s*\|?\s*/, "");
  const block = lines.slice(at + 1);
  const end = block.findIndex((line) => line.trim() !== "" && (line.match(/^\s*/) ?? [""])[0].length <= indent);
  return [inline, ...(end < 0 ? block : block.slice(0, end))].join("\n").trim();
}

/** The job's steps (`      - name:` items), each with its whole text and its run script. */
function stepsOf(text: string): Step[] {
  const lines = text.split("\n");
  const starts = lines.flatMap((line, index) => (/^ {6}- name: /.test(line) ? [index] : []));
  return starts.map((start, index) => {
    const own = lines.slice(start, starts[index + 1] ?? lines.length);
    return { name: own[0].replace(/^ {6}- name: /, "").trim(), body: own.join("\n"), run: runOf(own) };
  });
}

function usesLines(text: string): string[] {
  return text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line));
}

/** The lines from `first` up to the next line `next` matches, or the end. */
function section(text: string, first: string, next: RegExp): string {
  const lines = text.split("\n");
  const start = lines.indexOf(first);
  const end = lines.findIndex((line, index) => index > start && next.test(line));
  return start < 0 ? "" : lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

const blockOf = (text: string, key: string): string => section(text, `${key}:`, /^\S/);
const jobOf = (text: string, job: string): string => section(blockOf(text, "jobs"), `  ${job}:`, /^ {2}\S/);
const envOf = (text: string, name: string): string =>
  (blockOf(text, "env").match(new RegExp(`^ {2}${name}: '?(.*?)'?$`, "m")) ?? ["", ""])[1];
/** A step without its comments and blank lines: what it does. */
const codeOf = (step: Step): string => step.body.split("\n").filter((line) => !/^\s*(?:#.*)?$/.test(line)).join("\n");

function stepNamed(steps: readonly Step[], name: string): Step {
  const step = steps.find((candidate) => candidate.name === name);
  if (step === undefined) throw new Error(`no step named "${name}"`);
  return step;
}

/** Every named step exists, in this order. */
function expectInOrder(steps: readonly Step[], names: readonly string[]): void {
  const at = names.map((name) => steps.findIndex((step) => step.name === name));
  expect(at.every((index, n) => index >= 0 && (n === 0 || index > at[n - 1])), names.join(" < ")).toBe(true);
}

/** Every file git tracks, repo-relative. */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter((rel) => rel !== "");
}

/** True when `text` names a PEM private key anywhere but a comment line of a file under .github. */
function namesPrivateKey(rel: string, text: string): boolean {
  if (!text.includes(PEM_PRIVATE_LABEL)) return false;
  if (!rel.startsWith(".github/")) return true;
  return text.split("\n").some((line) => line.includes(PEM_PRIVATE_LABEL) && !/^\s*#/.test(line));
}

function fileNamesPrivateKey(rel: string): boolean {
  const path = join(ROOT, rel);
  return existsSync(path) && namesPrivateKey(rel, readFileSync(path).toString("latin1"));
}

describe("step parsing helper", () => {
  it("splits steps and reads inline and block run scripts", () => {
    const text = [
      "    steps:",
      "      - name: One",
      "        run: echo one",
      "      - name: Two",
      "        env:",
      "          A: b",
      "        run: |",
      "          echo two",
      "          echo three",
      "",
    ].join("\n");
    const steps = stepsOf(text);
    expect(steps.map((step) => step.name)).toEqual(["One", "Two"]);
    expect(steps[0].run).toBe("echo one");
    expect(steps[1].run).toBe("echo two\n          echo three");
  });
});

describe("theme-review.yml (C-02b)", () => {
  const text = readText(REVIEW);
  const steps = stepsOf(text);
  const install = steps.findIndex((step) => /\bnpm ci\b/.test(step.run));
  const afterInstall = steps.slice(install + 1);

  it("is run by a person, with the package URL and its expected digest", () => {
    expect(text).toMatch(/^on:\n {2}workflow_dispatch:\n {4}inputs:\n/m);
    expect(text).not.toMatch(OTHER_TRIGGERS);
    expect(text).toMatch(/^ {6}package_url:\n/m);
    expect(text).toMatch(/^ {6}expected_digest:\n/m);
  });

  it("gives its token no permissions, and widens none per job", () => {
    expect(text).toMatch(/^permissions: \{\}$/m);
    expect(text.match(/^\s*permissions:/gm)).toHaveLength(1);
  });

  it("reads no secrets", () => {
    expect(text).not.toMatch(/\bsecrets\./);
    expect(text).not.toMatch(/GITHUB_TOKEN|github\.token/);
  });

  it("pins every action to a full commit SHA and keeps no checkout credentials", () => {
    expect(usesLines(text).filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
    expect(text).toMatch(/actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false/);
  });

  it("runs the review in an image pinned by digest", () => {
    expect(text).toMatch(/^ {2}REVIEW_IMAGE: node:22\.\d+\.\d+-bookworm-slim@sha256:[0-9a-f]{64}$/m);
  });

  it("installs the kit from the lockfile with install scripts off", () => {
    expect(install).toBeGreaterThan(0);
    expect(steps[install].run).toBe("npm ci --ignore-scripts --no-audit --no-fund");
  });

  it("runs every step after the install in docker run --network none", () => {
    expect(afterInstall.length).toBeGreaterThan(0);
    afterInstall.forEach((step) => {
      expect(step.body, step.name).not.toMatch(/^\s*(?:-\s+)?uses:/m);
      expect(step.run, step.name).toMatch(/\bdocker run\b/);
      expect(step.run.match(/\bdocker run\b/g)?.length, step.name).toBe(step.run.match(/--network none\b/g)?.length);
    });
  });

  it("mounts the kit read-only and runs the kit's review script", () => {
    const review = afterInstall.map((step) => step.run).join("\n");
    expect(review).toContain('-v "$GITHUB_WORKSPACE:/kit:ro"');
    expect(review).toContain("node scripts/review/main.ts");
    expect(existsSync(join(ROOT, "scripts/review/main.ts"))).toBe(true);
  });

  it("downloads the package before the install, over https only", () => {
    const download = steps.findIndex((step) => /\bcurl\b/.test(step.run));
    expect(download).toBeGreaterThanOrEqual(0);
    expect(download).toBeLessThan(install);
    expect(steps[download].run).toContain("--proto '=https'");
  });

  it("passes the inputs through env, never into a script", () => {
    steps.forEach((step) => expect(step.run, step.name).not.toContain("${{"));
  });
});

describe("theme-sign.yml (C-03a signing step)", () => {
  const text = readText(SIGN);
  const steps = stepsOf(text);

  it("is run by a person with the signing request as input", () => {
    expect(text).toMatch(/^on:\n {2}workflow_dispatch:\n {4}inputs:\n {6}request:\n/m);
    expect(text).not.toMatch(OTHER_TRIGGERS);
  });

  it("gives its token no permissions", () => {
    expect(text).toMatch(/^permissions: \{\}$/m);
    expect(text.match(/^\s*permissions:/gm)).toHaveLength(1);
  });

  it("runs only on main, in the theme-signing environment that holds the key", () => {
    expect(text).toMatch(/^ {4}if: github\.ref == 'refs\/heads\/main'$/m);
    expect(text).toMatch(/^ {4}environment: theme-signing$/m);
  });

  it("documents that the theme-signing environment also needs required reviewers, either of whom may approve (QB-22)", () => {
    expect(text).toMatch(/^# .*must ALSO have$/m);
    expect(text).toMatch(/required reviewers/);
    expect(text).toMatch(/Prevent self-review/);
    expect([/either one may approve/.test(text), /second signer|two signers/i.test(text)]).toEqual([true, false]);
  });

  it("reads THEME_SIGNING_KEY and no other secret, once, in the signing step's env", () => {
    expect(text.match(/\bsecrets\.[A-Za-z0-9_]+/g)).toEqual([SIGNING_SECRET]);
    const holders = steps.filter((step) => step.body.includes(SIGNING_SECRET));
    expect(holders.map((step) => step.name)).toEqual(["Sign"]);
    expect(holders[0].body).toMatch(/\n\s+env:\n(?:\s+[A-Z_]+: .+\n)*\s+THEME_SIGNING_KEY: \$\{\{ secrets\.THEME_SIGNING_KEY \}\}\n/);
    expect(holders[0].run).toBe("node scripts/sign/cli.ts");
    expect(existsSync(join(ROOT, "scripts/sign/cli.ts"))).toBe(true);
  });

  it("installs nothing, so no package from npm runs next to the key", () => {
    steps.forEach((step) => expect(step.run, step.name).not.toMatch(/\b(?:npm|npx|yarn|pnpm)\b/));
  });

  it("pins every action and passes the request through env only", () => {
    expect(usesLines(text).filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
    expect(text).toMatch(/persist-credentials: false/);
    steps.forEach((step) => expect(step.run, step.name).not.toContain("${{"));
  });

  it("says verifying exists now (C-05m): the stale 'Verifying signatures is C-05' text is gone", () => {
    const sign = readText("scripts/sign/sign.ts");
    [text, sign].forEach((source) => {
      expect(source).not.toMatch(/Verifying signatures is (?:PRD-261 )?C-05/);
      expect(source).not.toMatch(/nothing verifies them yet/);
      expect(source).toContain("verify.ts");
    });
    expect(existsSync(join(ROOT, "scripts/sign/verify.ts"))).toBe(true);
  });
});

describe("the signing key stays in the sign workflow", () => {
  it("no other workflow names THEME_SIGNING_KEY", () => {
    const others = readdirSync(join(ROOT, WORKFLOWS))
      .filter((name) => /\.ya?ml$/.test(name) && `${WORKFLOWS}/${name}` !== SIGN)
      .filter((name) => readText(`${WORKFLOWS}/${name}`).includes("THEME_SIGNING_KEY"));
    expect(others).toEqual([]);
  });

  // The sign script runs with no install: only Node built-ins and files of this repo.
  it("the sign scripts import only node: built-ins and relative files", () => {
    const specifiers = SIGN_SCRIPTS.flatMap((rel) => Array.from(
      readText(rel).matchAll(/^import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm), (match) => match[1],
    ));
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((spec) => !spec.startsWith("node:") && !spec.startsWith("."))).toEqual([]);
  });

  it("no tracked file holds a PEM private key, except in a comment under .github", () => {
    const tracked = trackedFiles();
    expect(tracked).toEqual(expect.arrayContaining(["keys/theme-signing.json", "tests/fixtures/signing-vector.json"]));
    expect(tracked.filter(fileNamesPrivateKey)).toEqual([]);
  });

  it("the private key check allows the label only on a comment line under .github", () => {
    const label = `-----BEGIN ${PEM_PRIVATE_LABEL}-----`;
    expect(namesPrivateKey(".github/workflows/x.yml", `# a ${label} never goes here\non: push\n`)).toBe(false);
    expect(namesPrivateKey(".github/workflows/x.yml", `      run: echo "${label}"\n`)).toBe(true);
    expect(namesPrivateKey("keys/theme-signing.json", `${label}\n`)).toBe(true);
    expect(namesPrivateKey("keys/theme-signing.json", '{"schema":1,"keys":[]}\n')).toBe(false);
  });
});

describe("theme-release.yml (C-06a)", () => {
  const text = readText(RELEASE);
  const [release, signature] = ["release", "signature"].map((job) => stepsOf(jobOf(text, job)));
  const verifyRun = 'node scripts/sign/verify.ts "$PACK_DIR/$PACKAGE_NAME-$VERSION.autotheme" "$SIGNATURE" "$KEYS"';

  it("runs on a play-v tag, on a push to main that changes a signature (a folder no package holds), and by hand with one tag", () => {
    const on = blockOf(text, "on");
    const folder = envOf(text, "SIGNATURES_DIR");
    expect([on.match(/^ {2}\S+:$/gm), on.match(/^ {6}\S+:$/gm)]).toEqual([["  push:", "  workflow_dispatch:"], ["      tag:"]]);
    expect(on).toContain(`\n    branches: [main]\n    tags: ["play-v*"]\n    paths: ["${folder}/*.sig.json"]\n`);
    expect(jobOf(text, "release")).toContain("\n    if: github.event_name == 'push' && github.ref_type == 'tag'\n");
    expect(jobOf(text, "signature")).toContain("\n    if: github.ref == 'refs/heads/main'\n");
    expect(trackedFiles()).toContain(`${folder}/.gitkeep`);
    expect([...PACKED_FOLDERS, ...PACKED_TOP_FILES].filter((name) => folder.startsWith(`${envOf(text, "PLAY_DIR")}/${name}`))).toEqual([]);
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

  it("installs and builds as kit.yml does, alike in both jobs, and finds the package where Play's pack writes it", () => {
    ["Set up Node", "Pin npm", "Build"].forEach((name) => expect(codeOf(stepNamed(release, name))).toBe(codeOf(stepNamed(stepsOf(readText(KIT)), name))));
    ["Set up Node", "Pin npm", "Install (from the lockfile)", "Build", "Pack Play", "Checksum"].forEach((name) =>
      expect(codeOf(stepNamed(signature, name)), name).toBe(codeOf(stepNamed(release, name))));
    expect(stepNamed(signature, "Check a signing key is published").run).toBe(stepNamed(release, "Check a signing key is published").run);
    expect(stepNamed(release, "Install (from the lockfile)").run).toBe("npm ci --ignore-scripts --no-audit --no-fund");
    expect(stepNamed(release, "Pack Play").run).toBe('npm run pack --workspace "$PLAY_DIR"');
    const manifest = JSON.parse(readText("themes/play/theme.json"));
    expect([JSON.parse(readText("themes/play/package.json")).scripts.pack, envOf(text, "PLAY_DIR"), envOf(text, "PACK_DIR")])
      .toEqual(["automatos-theme pack . --out out", "themes/play", "themes/play/out"]);
    expect(`${envOf(text, "PACKAGE_NAME")}-${manifest.version}`).toBe(packageBaseName(manifest.id, manifest.version));
    [`sha256sum "$base${PACKAGE_EXTENSION}" > "$base${PACKAGE_EXTENSION}.sha256"`, `"$base${MANIFEST_SUFFIX}"`, '"$actual" != "$(summary zipSha256)"']
      .forEach((part) => expect(stepNamed(release, "Checksum").run).toContain(part));
  });

  it("releases a play-v<major>.<minor>.<patch> tag on main naming theme.json's version, a signature at it once verified", () => {
    const check = stepNamed(release, "Check the tag");
    expect(check.body).toContain("\n          TAG: ${{ github.ref_name }}\n");
    ['[[ "$TAG" =~ $TAG_PATTERN ]]', "git merge-base --is-ancestor HEAD refs/remotes/origin/main", '"$version" != "${TAG#play-v}"']
      .forEach((part) => expect(check.run).toContain(part));
    const pattern = new RegExp(envOf(text, "TAG_PATTERN"));
    const tags = ["play-v1.1.0", "play-v10.0.12", "play-v1.1", "play-v1.1.0-rc.1", "v1.1.0", "xplay-v1.1.0", "play-v1.1.0\n"];
    expect(tags.filter((tag) => pattern.test(tag))).toEqual(["play-v1.1.0", "play-v10.0.12"]);
    expect(stepNamed(release, "Find a signature at the tag").body).toContain("\n        id: signature\n");
    expectInOrder(release, ["Check the tag", "Install (from the lockfile)", "Pack Play", "Checksum", "Find a signature at the tag",
      "Check a signing key is published", "Verify the signature", "Publish the release"]);
    const gate = "\n        if: steps.signature.outputs.found == 'true'\n";
    ["Check a signing key is published", "Verify the signature"].forEach((name) => expect(stepNamed(release, name).body).toContain(gate));
    expect(stepNamed(release, "Verify the signature").run).toBe(verifyRun);
    ['assets=("$base.autotheme" "$base.autotheme.sha256")', 'gh release create "$TAG" "${assets[@]}" --verify-tag']
      .forEach((part) => expect(stepNamed(release, "Publish the release").run).toContain(part));
  });

  it("attaches a signature named by the tag input or the one changed file, from main's files, to the TAGGED build", () => {
    const find = stepNamed(signature, "Find the tag");
    expect(find.body).toContain("\n          TAG_INPUT: ${{ inputs.tag }}\n          BEFORE: ${{ github.event.before }}\n");
    ['--diff-filter=AM "$BEFORE" HEAD -- "$SIGNATURES_DIR/*.sig.json"', 'tag="play-v${name%.sig.json}"', '[[ "$tag" =~ $TAG_PATTERN ]]',
      'git rev-parse --quiet --verify "refs/tags/$tag^{commit}"'].forEach((part) => expect(find.run).toContain(part));
    expectInOrder(signature, ["Find the tag", "Keep the envelope and the keys", "Check a signing key is published",
      "Check out the tagged commit", "Install (from the lockfile)", "Build", "Pack Play", "Verify the signature", "Attach the signature"]);
    expect(stepNamed(signature, "Keep the envelope and the keys").run).toMatch(/cp "\$sig" [^\n]*\n\s*cp "\$KEYS_FILE" /);
    expect(stepNamed(signature, "Check out the tagged commit").run).toMatch(/^git checkout --quiet --detach "refs\/tags\/\$TAG"$/m);
    expect(["Verify the signature", "Attach the signature"].map((name) => stepNamed(signature, name).run))
      .toEqual([verifyRun, 'gh release upload "$TAG" "$SIGNATURE" --clobber']);
  });

  const script = stepNamed(release, "Check a signing key is published").run;
  const keysPath = join(mkdtempSync(join(tmpdir(), "theme-release-")), "keys.json");
  const keys = (...statuses: string[]): string =>
    JSON.stringify({ schema: 1, keys: statuses.map((status) => ({ keyId: "ed25519:0123456789abcdef", spki: "AAAA", status, added: "2026-10-20" })) });

  it.each([
    ["no key, as the file ships until the production key", 1, keys(), /^::error::No signing key yet: keys\/theme-signing\.json holds no active key/m],
    ["no active key", 1, keys("retired", "revoked"), /^::error::No signing key yet: /m],
    ["a file that isn't a keys file", 1, "{", /^::error::keys\/theme-signing\.json can't be read as a keys file/m],
    ["an active key", 0, keys("active"), /^keys\/theme-signing\.json holds 1 active signing key\(s\)\.$/m],
  ])("the key check, run as the runner's bash runs it, on %s: exit %i with one plain line, never a stack trace", (_, status, keysText, line) => {
    writeFileSync(keysPath, keysText);
    const env = { PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`, KEYS: keysPath, KEYS_FILE: envOf(text, "KEYS_FILE") };
    const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], { encoding: "utf8", env });
    expect([result.status, result.stderr]).toEqual([status, ""]);
    expect(result.stdout).toMatch(line);
  });
});

describe("docs/OFFICIAL-LISTING.md, the owner's run that lists Play (C-06b)", () => {
  const doc = readText(LISTING);

  it("is linked from theme-sign.yml's header and the README, which gives a local edition the release, hosted the listing", () => {
    expect(section(readText(SIGN), "name: Theme sign", /^on:$/)).toMatch(/^# .*docs\/OFFICIAL-LISTING\.md/m);
    ["](docs/OFFICIAL-LISTING.md)", "https://github.com/AutomatosAI/automatos-design-kit/releases", ".sig.json",
      "Settings › Appearance › Themes › Install theme", "Marketplace › Themes"].forEach((part) => expect(readText("README.md")).toContain(part));
  });

  it("lists steps 0 to 7 (workflows, inputs, admin-queue buttons, the review at the tag), no key or signature, never two signers", () => {
    expect(doc.match(/^### \d+\. /gm)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"].map((n) => `### ${n}. `));
    expect(doc).toMatch(/^gh workflow run theme-review\.yml --ref play-v<v> -f package_url=https:\S+ -f expected_digest=\S+$/m);
    const buttons = ["Choose a .autotheme file", "Submit for review", "Save review note", "Approve", "Copy request", "Save signature",
      "Deactivate", "Add to my workspace", "Use this theme"].map((label) => `**${label}**`);
    ["theme-release.yml", "gh workflow run theme-sign.yml --ref main -f request=", "themes/play/signatures/<v>.sig.json",
      "`tag` set to `play-v<v>`", "either one may approve", ...buttons].forEach((part) => expect(doc).toContain(part));
    expect(doc).not.toMatch(/[A-Za-z0-9+/]{43,}/);
    [doc, readText("README.md")].forEach((text) => expect(text).not.toMatch(/second signer|two signers/i));
  });
});
