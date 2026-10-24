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

// PRD-261 K-20: core's A-19 merge removed builtin Play, so Play lives only in this kit. The old rule, a Play change
// made in core and here with each pull request naming the other, must not come back in any doc. Play's own README,
// which is packed and so changes only with a new Play version, dropped it in Play 1.1.1 (K-21): it is read too.
const MIRROR_RULE = [
  /\bmade\s+here\s+too\b/i,
  /\bboth\s+repositories\b/i,
  /\bnaming\s+the\s+other\b/i,
  /\bmirror(?:s|ed|ing)?\s+(?:a\s+)?Play\b/i,
];
const PACKED_PLAY_README = "themes/play/README.md";
// The rule as AGENTS.md had it, so the check is shown to find it.
const OLD_MIRROR_RULE =
  "Until PRD-261 A-19 removes builtin Play from core, a Play change in core is made here too, each pull request naming the other.";

const mirrorRuleIn = (text: string): RegExp[] => MIRROR_RULE.filter((pattern) => pattern.test(text));

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

// The text of one `## <heading>` section, up to the next `## ` heading.
function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) throw new Error(`no "## ${heading}" section`);
  const end = text.indexOf("\n## ", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
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

// PRD-261 B-02e and B-02f: theme-harness also holds the browser harness that `automatos-theme shots` photographs, in
// kit.yml's own harness job; the contract says so, not only the package's README.
describe("AGENTS.md describes the browser harness and the job that runs it", () => {
  const text = readText("AGENTS.md");

  it("its Layout says theme-harness holds the browser harness that `automatos-theme shots` photographs", () => {
    expect(sectionOf(text, "Layout")).toMatch(/`theme-harness`[\s\S]*\bbrowser\s+harness\b[\s\S]*`automatos-theme\s+shots`/);
  });

  it("its What CI runs section names kit.yml's harness job", () => {
    expect(sectionOf(text, "What CI runs")).toMatch(/`harness`\s+job/);
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

describe("no doc keeps the rule that mirrored Play into core (K-20)", () => {
  const files = trackedMarkdown();

  it("finds the old rule in its own text", () => {
    expect(mirrorRuleIn(OLD_MIRROR_RULE)).not.toEqual([]);
  });

  it.each(["AGENTS.md", "CLAUDE.md", "docs/PLAY-HISTORY.md", PACKED_PLAY_README])("%s is among the docs read", (file) => {
    expect(files).toContain(file);
  });

  it.each(files)("%s has no mirror rule", (file) => {
    expect(mirrorRuleIn(readText(file))).toEqual([]);
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
