// PRD-261 C-02b and C-03a (D3, 19 Oct): the two person-run workflows, read as files.
// theme-review.yml holds no secret, its token has no permissions, and every step after the
// install runs in `docker run --network none`. theme-sign.yml reads one secret,
// THEME_SIGNING_KEY, in its signing step only, and installs nothing. Nothing is run here.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKFLOWS = ".github/workflows";
const REVIEW = `${WORKFLOWS}/theme-review.yml`;
const SIGN = `${WORKFLOWS}/theme-sign.yml`;
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
const OTHER_TRIGGERS = /^ {2}(?:push|pull_request|pull_request_target|schedule|workflow_run|workflow_call|repository_dispatch|issue_comment):/m;
const SIGNING_SECRET = "secrets.THEME_SIGNING_KEY";

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

  it("documents that the theme-signing environment also needs required reviewers, self-review prevented", () => {
    expect(text).toMatch(/^# .*must ALSO have$/m);
    expect(text).toMatch(/required reviewers/);
    expect(text).toMatch(/Prevent self-review/);
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
    const files = ["scripts/sign/cli.ts", "scripts/sign/sign.ts", "scripts/sign/request.ts", "packages/theme-cli/src/digest.ts"];
    const specifiers = files.flatMap((rel) => Array.from(
      readText(rel).matchAll(/^import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm), (match) => match[1],
    ));
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((spec) => !spec.startsWith("node:") && !spec.startsWith("."))).toEqual([]);
  });
});
