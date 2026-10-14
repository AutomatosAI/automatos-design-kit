// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, type NavId } from "@/components/shell/nav";

// PRD-003 P-011 (and B-008 after it): every main page that is in the nav is in the README
// and has its section in the run checklist, and docs/SKILL-GAPS.md's count line matches its
// tables.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** PRD-003's pages: each one is documented once its nav item is ready. */
const MAIN_PAGES: readonly NavId[] = ["missions", "board", "playbooks", "agents", "knowledge", "analytics"];

const shownPages = NAV_ITEMS.filter((item) => MAIN_PAGES.includes(item.id));

/** The rows of the table under a `## <heading>` (rows that start with a story id). */
function tableRows(markdown: string, heading: string): number {
  const start = markdown.indexOf(`\n## ${heading}\n`);
  if (start < 0) return -1;
  const rest = markdown.slice(start + heading.length + 5);
  const end = rest.indexOf("\n## ");
  const section = end < 0 ? rest : rest.slice(0, end);
  return section.split("\n").filter((line) => /^\| [A-Z]+-\d+ \|/.test(line)).length;
}

describe("the main pages are documented", () => {
  it("wave 3's pages are in the nav", () => {
    expect(shownPages.map((item) => item.id)).toEqual(expect.arrayContaining(["missions", "agents", "knowledge"]));
  });

  it("the README names each page with its address", () => {
    const readme = read("README.md");
    for (const item of shownPages) {
      expect(readme).toContain(`**${item.label}**`);
      expect(readme).toContain(`\`${item.href}\``);
    }
    expect(readme).toContain("docs/prd/PRD-003-MAIN-PAGES.md");
  });

  it("the run checklist has a section for each page", () => {
    const checklist = read("docs/RUN-CHECKLIST.md");
    for (const item of shownPages) expect(checklist).toContain(`\n### ${item.label}\n`);
  });

  it("the checklist covers what P-011 asks of each section", () => {
    const checklist = read("docs/RUN-CHECKLIST.md");
    for (const text of ["**Start from chat.**", "**Approve a plan.**", "**Watch it run.**", "**Cancel.**"]) {
      expect(checklist).toContain(text);
    }
    for (const text of ["**Auto first.**", "**Fleet state.**", "**Switch an agent off and on.**"]) {
      expect(checklist).toContain(text);
    }
    for (const text of ["**Upload each type.**", "**A duplicate.**", "**A too-big file", "**Search.**", "**Download.**", "**Delete.**"]) {
      expect(checklist).toContain(text);
    }
  });
});

describe("docs/SKILL-GAPS.md", () => {
  const gaps = read("docs/SKILL-GAPS.md");

  it("the count line matches the tables", () => {
    const count = /\*\*Count:\*\* (\d+) skill gaps[^\n]*?, (\d+) mock gaps[^\n]*?(\d+) design gaps/.exec(gaps);
    expect(count).not.toBeNull();
    expect(Number(count?.[1])).toBe(tableRows(gaps, "The skill"));
    expect(Number(count?.[2])).toBe(tableRows(gaps, "The mocks"));
    expect(Number(count?.[3])).toBe(tableRows(gaps, "Design gaps"));
  });

  it("logs the wave 3 docs pass", () => {
    expect(gaps).toMatch(/^\| P-011 \|/m);
  });
});
