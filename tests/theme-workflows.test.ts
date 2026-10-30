// PRD-261 C-02b and C-03a (D3, 19 Oct): the person-run review workflow, read as a file, and where the signing key
// may be named. theme-review.yml holds no secret, its token has no permissions, and every step after the
// install runs in `docker run --network none`. theme-sign.yml is retired: the publish run signs what a merge to
// main built (theme-publish.yml; tests/theme-publish.test.ts), and only its Sign step reads THEME_SIGNING_KEY.
// Nothing is run here. C-05m adds the verify script; no private key is
// committed anywhere. C-06a's theme-release.yml, which releases Play, HUD and Arcade from their tags, has its
// own file, tests/theme-release.test.ts; the listing run (docs/OFFICIAL-LISTING.md) stays here. The
// workflow-reading helpers are tests/support/workflow-steps.ts. PRD-261 B-02j: after the review, and only
// once it has passed, theme-review.yml runs a report-only axe pass outside the container; every step up to
// the review still runs in it, and the axe pass's steps can't change the job's result.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, readText, section, stepNamed, stepsOf, trackedFiles, usesLines } from "./support/workflow-steps.ts";

const WORKFLOWS = ".github/workflows";
const REVIEW = `${WORKFLOWS}/theme-review.yml`;
const PUBLISH = `${WORKFLOWS}/theme-publish.yml`;
const LISTING = "docs/OFFICIAL-LISTING.md";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
const REVIEW_STEP = "Review (no network)";
const BROWSERS_STEP = "Install browsers for the axe pass (report only)";
const AXE_STEP = "Axe over harness shots of the package (report only)";
const AXE_SCRIPT = "scripts/review/axe.ts";
/** The browsers the harness shots run on, installed as kit.yml's harness job installs them. */
const INSTALL_BROWSERS = "npx playwright install --with-deps chromium webkit";
/** What the review itself takes on a cold runner (install, image, rebuild), with room to spare. */
const REVIEW_MINUTES = 10;
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
  const reviewAt = steps.findIndex((step) => step.name === REVIEW_STEP);
  /** The install's next steps, up to and including the review: the container's. */
  const isolated = steps.slice(install + 1, reviewAt + 1);
  /** The steps after the review: the report-only axe pass (B-02j). */
  const reportOnly = steps.slice(reviewAt + 1);

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

  it("runs every step from the install to the review in docker run --network none", () => {
    expect(reviewAt).toBeGreaterThan(install);
    expect(isolated.length).toBeGreaterThan(0);
    isolated.forEach((step) => {
      expect(step.body, step.name).not.toMatch(/^\s*(?:-\s+)?uses:/m);
      expect(step.run, step.name).toMatch(/\bdocker run\b/);
      expect(step.run.match(/\bdocker run\b/g)?.length, step.name).toBe(step.run.match(/--network none\b/g)?.length);
    });
  });

  it("mounts the kit read-only and runs the kit's review script", () => {
    const review = isolated.map((step) => step.run).join("\n");
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

  it("runs only the report-only axe pass after the review (B-02j), on success only, each step continuing on an error", () => {
    expect(reportOnly.map((step) => step.name)).toEqual([BROWSERS_STEP, AXE_STEP]);
    reportOnly.forEach((step) => {
      expect(step.body, step.name).toMatch(/\n {8}if: success\(\)\n/);
      expect(step.body, step.name).toMatch(/\n {8}continue-on-error: true\n/);
      expect(step.body, step.name).toMatch(/\n {8}timeout-minutes: \d+\n/);
    });
  });

  it("runs the axe pass outside the container, with no action, on the browsers kit.yml's harness job installs", () => {
    reportOnly.forEach((step) => {
      expect(step.run, step.name).not.toMatch(/\bdocker\b/);
      expect(step.body, step.name).not.toMatch(/^\s*(?:-\s+)?uses:/m);
    });
    expect(stepNamed(steps, BROWSERS_STEP).run).toBe(INSTALL_BROWSERS);
    expect(readText(".github/workflows/kit.yml")).toContain(`run: ${INSTALL_BROWSERS}`);
  });

  it("gives the axe pass the downloaded package and a work folder of its own, never the review's", () => {
    const run = stepNamed(steps, AXE_STEP).run;
    expect(run).toContain('REVIEW_PACKAGE="$RUNNER_TEMP/review/package.autotheme"');
    expect(run).toContain('AXE_WORK="$RUNNER_TEMP/review-axe"');
    expect(run).toContain('REVIEW_SUMMARY="$GITHUB_STEP_SUMMARY"');
    expect(run).toMatch(new RegExp(`\\bnode ${AXE_SCRIPT.replace(/[/.]/g, (char) => `\\${char}`)}$`));
    expect(run).not.toMatch(/\$RUNNER_TEMP\/review\/work\b|\/review-summary\.md/);
    expect(stepNamed(steps, REVIEW_STEP).run).not.toContain("review-axe");
    expect(existsSync(join(ROOT, AXE_SCRIPT))).toBe(true);
  });

  it("leaves the job room for the review and both of the axe pass's own timeouts", () => {
    const job = Number(/^ {4}timeout-minutes: (\d+)$/m.exec(text)?.[1]);
    const own = reportOnly.map((step) => Number(/\n {8}timeout-minutes: (\d+)\n/.exec(step.body)?.[1]));
    expect(job).toBeGreaterThanOrEqual(REVIEW_MINUTES + own.reduce((sum, minutes) => sum + minutes, 0));
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

  it("says Arcade is published the same way, its first version by the first publish run, with its own tag and assets", () => {
    ["**Arcade**", "`automatos/arcade`", "`themes/arcade`", "`arcade-v1.0.0`", "`automatos.arcade-1.0.0.autotheme`",
      "`1.0.0.sig.json`"].forEach((part) => expect(doc).toContain(part));
    expect(doc).toMatch(/Push no\s+`arcade-v\*` tag by hand/);
    expect(doc).not.toMatch(/`--ref arcade-v<v>`|`tag` set to `arcade-v<v>`|themes\/arcade\/signatures\//);
    ["## Install Arcade", "`arcade-v<version>`", "`automatos.arcade-<version>.autotheme`"]
      .forEach((part) => expect(readText("README.md")).toContain(part));
  });
});
