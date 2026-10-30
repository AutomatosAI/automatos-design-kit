// PRD-261 C-02b and C-03a (D3, 19 Oct): the two person-run workflows, read as files.
// theme-review.yml holds no secret, its token has no permissions, and every step after the
// install runs in `docker run --network none`. theme-sign.yml reads one secret,
// THEME_SIGNING_KEY, in its signing step only, and installs nothing. Nothing is run here. C-05m
// adds the verify script and the key id and envelope the sign step prints; no private key is
// committed anywhere. C-06a's theme-release.yml, which releases Play, HUD and Arcade from their tags, has its
// own file, tests/theme-release.test.ts; the listing run (docs/OFFICIAL-LISTING.md) stays here. The
// workflow-reading helpers are tests/support/workflow-steps.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, readText, section, stepsOf, trackedFiles, usesLines } from "./support/workflow-steps.ts";

const WORKFLOWS = ".github/workflows";
const REVIEW = `${WORKFLOWS}/theme-review.yml`;
const SIGN = `${WORKFLOWS}/theme-sign.yml`;
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
    expect(namesPrivateKey("keys/theme-signing.json", readText("keys/theme-signing.json"))).toBe(false);
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

  it("stays Play's run, and says HUD follows the same steps with its own tag, asset and signatures folder", () => {
    expect(doc).toMatch(/^# Listing Play as the official theme$/m);
    ["**HUD**", "follows the same steps", "`hud-v<v>`", "`automatos.hud-<v>.autotheme`", "`themes/hud/signatures/<v>.sig.json`",
      "`--ref hud-v<v>`", "`tag` set to `hud-v<v>`"].forEach((part) => expect(doc).toContain(part));
    ["## Install HUD", "`hud-v<version>`", "`automatos.hud-<version>.autotheme`"].forEach((part) => expect(readText("README.md")).toContain(part));
  });

  it("says Arcade follows the same steps too, with its own tag, asset and signatures folder", () => {
    ["**Arcade**", "follows the same steps", "`arcade-v<v>`", "`automatos.arcade-<v>.autotheme`",
      "`themes/arcade/signatures/<v>.sig.json`", "`--ref arcade-v<v>`", "`tag` set to `arcade-v<v>`"]
      .forEach((part) => expect(doc).toContain(part));
    ["## Install Arcade", "`arcade-v<version>`", "`automatos.arcade-<version>.autotheme`"]
      .forEach((part) => expect(readText("README.md")).toContain(part));
  });
});
