// PRD-261 B-00a (PB-16): kit-lockfile.yml, read as a file. A person dispatches it on a branch
// that changed package.json; it resolves package-lock.json with the npm kit.yml pins, runs no
// dependency code, holds no secret, and uploads the lockfile as the kit-lockfile artifact.
// Nothing is run here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCKFILE_WORKFLOW = ".github/workflows/kit-lockfile.yml";
const KIT_WORKFLOW = ".github/workflows/kit.yml";
const PIN_NPM = "npm install -g npm@11.21.1";
const RESOLVE = "npm install --package-lock-only --ignore-scripts --no-audit --no-fund";
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
const OTHER_TRIGGERS = /^ {2}(?:push|pull_request|pull_request_target|schedule|workflow_run|workflow_call|repository_dispatch|issue_comment):/m;
const SHARED_ACTIONS = ["actions/checkout", "actions/setup-node", "actions/upload-artifact"] as const;

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// Every `uses:` value (action@sha, without the trailing comment), in file order.
function usesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line)?.[1])
    .filter((uses): uses is string => typeof uses === "string");
}

// The `run:` commands, in file order. Every run in this workflow is one inline line (asserted below).
function runsOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^\s*run:\s*(.+)$/.exec(line)?.[1]?.trim())
    .filter((run): run is string => typeof run === "string");
}

function pinOf(text: string, action: string): string | undefined {
  return usesOf(text).find((uses) => uses.startsWith(`${action}@`));
}

describe("workflow text helpers", () => {
  it("read uses values without comments and inline run lines in order", () => {
    const text = [
      "      - name: A",
      "        uses: actions/checkout@abc # v1",
      "      - uses: actions/setup-node@def",
      "      - name: B",
      "        run: echo one",
      "      - name: C",
      "        run:   echo two  ",
    ].join("\n");
    expect(usesOf(text)).toEqual(["actions/checkout@abc", "actions/setup-node@def"]);
    expect(runsOf(text)).toEqual(["echo one", "echo two"]);
    expect(pinOf(text, "actions/setup-node")).toBe("actions/setup-node@def");
  });
});

describe("kit-lockfile.yml (B-00a)", () => {
  const text = readText(LOCKFILE_WORKFLOW);
  const kit = readText(KIT_WORKFLOW);
  const runs = runsOf(text);

  it("is run by a person only, with no inputs", () => {
    expect(text).toMatch(/^on:\n {2}workflow_dispatch:\n\n/m);
    expect(text).not.toMatch(OTHER_TRIGGERS);
    expect(text).not.toMatch(/^ {4}inputs:/m);
  });

  it("gives its token exactly contents: read, and widens nothing per job", () => {
    expect(text).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    expect(text.match(/^\s*permissions:/gm)).toHaveLength(1);
  });

  it("reads no secrets and no token", () => {
    expect(text).not.toMatch(/\bsecrets\./);
    expect(text).not.toMatch(/GITHUB_TOKEN|github\.token/);
    expect(text).not.toContain("${{");
  });

  it("pins every action to a full commit SHA and keeps no checkout credentials", () => {
    expect(usesOf(text)).toHaveLength(SHARED_ACTIONS.length);
    expect(text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line) && !PINNED_ACTION.test(line))).toEqual([]);
    expect(text).toMatch(/actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false/);
  });

  it("uses the same action pins and Node version as kit.yml", () => {
    SHARED_ACTIONS.forEach((action) => {
      expect(pinOf(text, action), action).toBeDefined();
      expect(pinOf(text, action), action).toBe(pinOf(kit, action));
    });
    const nodeVersion = /node-version: "(\d+)"/;
    expect(nodeVersion.exec(text)?.[1]).toBe(nodeVersion.exec(kit)?.[1]);
  });

  it("pins npm 11.21.1 as kit.yml does, then resolves the lockfile only, with install scripts off", () => {
    expect(runsOf(kit)[0]).toBe(PIN_NPM);
    expect(runs.slice(0, 2)).toEqual([PIN_NPM, RESOLVE]);
    expect(text).not.toMatch(/^\s*run:\s*[|>]/m);
  });

  it("runs no other npm command, so no package code is installed or run", () => {
    const npm = runs.filter((run) => /\b(?:npm|npx|yarn|pnpm|node)\b/.test(run));
    expect(npm).toEqual([PIN_NPM, RESOLVE]);
  });

  it("uploads package-lock.json as kit-lockfile and fails when it is missing", () => {
    expect(text).toMatch(
      /uses: actions\/upload-artifact@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+name: kit-lockfile\n\s+path: package-lock\.json\n\s+if-no-files-found: error\n/,
    );
  });
});

describe("AGENTS.md, Adding a dependency", () => {
  const text = readText("AGENTS.md");
  const section = /^## Adding a dependency\n\n((?:.+\n)+)/m.exec(text)?.[1] ?? "";

  it("says in three lines how a dependency change gets its lockfile", () => {
    expect(section.trimEnd().split("\n")).toHaveLength(3);
    expect(section).toContain("kit-lockfile.yml");
    expect(section).toContain("kit-lockfile");
    expect(section).toContain("npm ci");
  });
});
