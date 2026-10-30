// PRD-261 C-02b and C-03a (D3, 19 Oct): the person-run review workflow, read as a file, and where the signing key
// may be named. theme-review.yml holds no secret, its token has no permissions, and every step after the
// install runs in `docker run --network none`. theme-sign.yml is retired: the publish run signs what a merge to
// main built (theme-publish.yml; tests/theme-publish.test.ts), and only its Sign step reads THEME_SIGNING_KEY.
// Nothing is run here. C-05m adds the verify script; no private key is
// committed anywhere. C-06a's theme-release.yml, which releases Play and HUD from their tags, has its
// own file, tests/theme-release.test.ts; the listing run (docs/OFFICIAL-LISTING.md) stays here. The
// workflow-reading helpers are tests/support/workflow-steps.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, readText, section, stepsOf, trackedFiles, usesLines } from "./support/workflow-steps.ts";

const WORKFLOWS = ".github/workflows";
const REVIEW = `${WORKFLOWS}/theme-review.yml`;
const PUBLISH = `${WORKFLOWS}/theme-publish.yml`;
const LISTING = "docs/OFFICIAL-LISTING.md";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
const OTHER_TRIGGERS = /^ {2}(?:push|pull_request|pull_request_target|schedule|workflow_run|workflow_call|repository_dispatch|issue_comment):/m;
const SIGNING_SECRET = "secrets.THEME_SIGNING_KEY";
/** A PEM private key's armour label, built so that this file doesn't spell it out. */
const PEM_PRIVATE_LABEL = ["PRIVATE", "KEY"].join(" ");
/** What the publish job runs next to a key, with nothing installed: the sign scripts and what they import. */
const SIGN_SCRIPTS = [
  "scripts/sign/from-pack.ts", "scripts/sign/sign.ts", "scripts/sign/request.ts", "scripts/sign/envelope.ts",
  "scripts/sign/verify.ts", "scripts/release/publish-answer.ts", "packages/theme-cli/src/digest.ts", "packages/theme-cli/src/zip.ts",
];
/** The publish job's two keys, each the secret of one of its steps. */
const PUBLISH_SECRETS = ["THEME_SIGNING_KEY", "THEME_PUBLISH_KEY"];

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

describe("the signing and publish keys stay in the publish workflow", () => {
  it("no other workflow names THEME_SIGNING_KEY or THEME_PUBLISH_KEY, and theme-sign.yml is gone", () => {
    expect(existsSync(join(ROOT, WORKFLOWS, "theme-sign.yml"))).toBe(false);
    const others = readdirSync(join(ROOT, WORKFLOWS))
      .filter((name) => /\.ya?ml$/.test(name) && `${WORKFLOWS}/${name}` !== PUBLISH)
      .filter((name) => PUBLISH_SECRETS.some((secret) => readText(`${WORKFLOWS}/${name}`).includes(secret)));
    expect(others).toEqual([]);
    expect(readText(PUBLISH).match(new RegExp(`\\b${SIGNING_SECRET.replace(".", "\\.")}\\b`, "g"))).toHaveLength(1);
  });

  // The publish job's scripts run with no install: only Node built-ins and files of this repo.
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
    expect(namesPrivateKey("keys/theme-signing.json", readText("keys/theme-signing.json"))).toBe(false);
  });
});

describe("docs/OFFICIAL-LISTING.md, how a merge lists a theme", () => {
  const doc = readText(LISTING);

  it("is linked from theme-publish.yml's header and the README, which gives a local edition the release, hosted the listing", () => {
    expect(section(readText(PUBLISH), "name: Theme publish", /^on:$/)).toMatch(/^# .*docs\/OFFICIAL-LISTING\.md/m);
    ["](docs/OFFICIAL-LISTING.md)", "https://github.com/AutomatosAI/automatos-design-kit/releases", ".sig.json",
      "Settings › Appearance › Themes › Install theme", "Marketplace › Themes"].forEach((part) => expect(readText("README.md")).toContain(part));
    ["## Install HUD", "`hud-v<version>`", "`automatos.hud-<version>.autotheme`"].forEach((part) => expect(readText("README.md")).toContain(part));
  });

  it("says the merge is the approval, and names the environment, its two secrets and its variable, no key or signature", () => {
    ["The merge is the approval", "`theme-publish`", "`THEME_SIGNING_KEY`", "`THEME_PUBLISH_KEY`", "`THEME_PUBLISH_API_URL`",
      "`release/publishers.json`", "`/api/marketplace/themes/publish`", "theme-publish.yml"].forEach((part) => expect(doc).toContain(part));
    expect(doc).not.toMatch(/[A-Za-z0-9+/]{43,}/);
    expect(doc).not.toMatch(/theme-sign\.yml|`theme-signing`|Copy request|Save signature/);
    [doc, readText("README.md")].forEach((text) => expect(text).not.toMatch(/second signer|two signers/i));
  });

  it("says what blocks a publish, how to rotate and revoke each key, and how a backfill runs", () => {
    ["## What blocks a publish", "## Rotate and revoke", "## Backfill"].forEach((heading) => expect(doc).toMatch(new RegExp(`^${heading}$`, "m")));
    ["401", "403", "409", "422", "503"].forEach((status) => expect(doc).toContain(`**${status}**`));
    expect(doc).toMatch(/^gh workflow run theme-publish\.yml --ref main -f tag=play-v1\.2\.1$/m);
    expect(doc).toMatch(/^gh workflow run theme-publish\.yml --ref main -f tag=hud-v1\.1\.2$/m);
  });
});
