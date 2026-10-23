// PRD-261 B-01a: the kit's root docs describe the kit as it is — not the earlier local-only pilot,
// and not core's own rules. These checks read tracked files only; nothing is installed or built.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRD_001 = "docs/prd/PRD-001-FUN-UI-PILOT.md";

// Phrases that described the dropped local-only pilot, or core's own rules, and must not come back.
const CLAUDE_FORBIDDEN = ["never require a change in the core", "nowhere else", "Local edition only"];
const README_FORBIDDEN = ["not built yet", "stay local until"];

// The three facts every front-page doc must carry: themes run on both editions, the CLI is narrower
// (local edition), and hosted CLI auth is a parked decision, not a gap.
// Docs wrap at a fixed width, so a phrase may break across lines: words are joined by any whitespace.
const EDITIONS_FACT = /\b(?:both|local\s+edition\s+and\s+the\s+hosted\s+edition)\b[^.]*\bhosted\s+edition\b/i;
const CLI_LOCAL_FACT = /\bpack\b[^.]*\bsubmit\b[^.]*\blocal\s+edition\b/i;
const HOSTED_AUTH_DEFERRED_FACT = /hosted\s+CLI\s+auth[^.]*(?:parked|deferred)/i;

// Names of planning artifacts a public doc must never point at.
const FORBIDDEN_DOC_REFS = ["docs/prd/core", "scripts/ralph/prd-261.json", ".claude/"];

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function trackedMarkdown(): string[] {
  return execFileSync("git", ["ls-files", "-z", "*.md"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

function topLevelDirs(rel: string): string[] {
  return readdirSync(join(ROOT, rel), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe("CLAUDE.md no longer describes the dropped local-only pilot", () => {
  const text = readText("CLAUDE.md");

  it.each(CLAUDE_FORBIDDEN)("does not contain %j", (phrase) => {
    expect(text).not.toContain(phrase);
  });
});

describe("README.md no longer describes the kit as unbuilt", () => {
  const text = readText("README.md");

  it.each(README_FORBIDDEN)("does not contain %j", (phrase) => {
    expect(text).not.toContain(phrase);
  });
});

describe("CLAUDE.md and AGENTS.md state the edition and CLI facts", () => {
  it.each(["CLAUDE.md", "AGENTS.md"])("%s says themes run on both editions", (file) => {
    expect(readText(file)).toMatch(EDITIONS_FACT);
  });

  it.each(["CLAUDE.md", "AGENTS.md"])("%s says the CLI's pack and submit target the local edition", (file) => {
    expect(readText(file)).toMatch(CLI_LOCAL_FACT);
  });

  it.each(["CLAUDE.md", "AGENTS.md"])("%s says hosted CLI auth is a parked decision", (file) => {
    expect(readText(file)).toMatch(HOSTED_AUTH_DEFERRED_FACT);
  });
});

describe("AGENTS.md's Layout section names every packages/* folder", () => {
  const text = readText("AGENTS.md");

  it.each(topLevelDirs("packages"))("names packages/%s", (name) => {
    expect(text).toContain(name);
  });
});

describe("no tracked doc names a planning-only path", () => {
  const files = trackedMarkdown();

  it("found at least one tracked markdown file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s names no planning-only path", (file) => {
    const text = readText(file);
    for (const forbidden of FORBIDDEN_DOC_REFS) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("PRD-001, kept by QB-30, is reframed as superseded", () => {
  const brought = existsSync(join(ROOT, PRD_001));

  it("is present (QB-30 kept it)", () => {
    expect(brought).toBe(true);
  });

  it.runIf(brought)("opens with a Superseded-by-PRD-261 header", () => {
    expect(readText(PRD_001)).toMatch(/^>\s*\*\*Superseded by PRD-261\.\*\*/m);
  });

  it.runIf(brought)("names no maintainer by name", () => {
    expect(readText(PRD_001)).not.toMatch(/\bGerard\b/);
  });
});
