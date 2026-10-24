// PRD-261 B-01c: the skill-index lint. Every skills/<folder>/SKILL.md is a Claude Code Agent Skill: its frontmatter
// `name` is its folder (lower-case letters, digits and dashes, at most 64), its `description` is 1 to 1024 characters
// of plain YAML text, and it is listed once in skills/README.md, whose every row names a folder that is there. Every
// relative link in skills/ resolves; every `automatos-theme <command>` a skill names is one the CLI has built. No
// skill teaches what a theme may not do: ORCHESTRATOR_API_KEY, a REST path, a proxy route, localStorage (named only
// as the JS rule that refuses it, in pass-marketplace-review), and build-automatos-interface appears on one line
// only, the one that says it is superseded. No skill names a local path, a planning file or a person.
// PRD-261 B-04a: the one REST path a skill may name is the brand kit's, `/api/documents/brand-kit` and the routes under
// it, and only in the two brand skills: the person or agent saves the local edition's answer to a file before any theme
// code exists (the theme itself calls nothing). Both skills name that route on the local edition, and no brand skill
// names a hosted address, a token or a credential header (E2: hosted CLI auth is parked).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../packages/theme-cli/src/cli-main.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS = "skills";
const INDEX = `${SKILLS}/README.md`;
const SKILL_FILE = "SKILL.md";
const CLI_MAIN = new URL("../packages/theme-cli/src/cli-main.ts", import.meta.url);

/** The Agent Skills rules for the two fields Claude Code reads. */
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const RESERVED_NAME_WORDS = ["anthropic", "claude"];
const DESCRIPTION_MAX = 1024;
/** What would end or change a plain YAML scalar on one line: a key separator, a comment, a leading indicator. */
const NOT_PLAIN_YAML = /: |\s#|^[-?:,[\]{}#&*!|>'"%@`]/;

const NEVER = ["ORCHESTRATOR_API_KEY", "/api/", "proxy route"];
const API_PREFIX = "/api/";
const BRAND_KIT_ROUTE = "/api/documents/brand-kit";
const BRAND_SKILLS = ["brand-a-theme", "white-label-from-a-brand-kit"];
/** The local edition's API, where a brand skill reads the brand kit. */
const LOCAL_BRAND_KIT = `http://localhost:8000${BRAND_KIT_ROUTE}`;
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const CREDENTIALS = ["AUTOMATOS_API_TOKEN", "Authorization", "Bearer", "X-API-Key", "x-api-key"];
const URL_LIKE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>`)\]]+/gi;
const STORAGE_WORD = "localStorage";
const STORAGE_SKILL = "pass-marketplace-review";
const STORAGE_RULE = "JS_LOCAL_STORAGE";
const OLD_SKILL = "build-automatos-interface";
const SUPERSEDES = "supersedes";
const FORBIDDEN_TEXT = [
  "/Users/", "/home/", ".claude/", ".worktrees", "docs/prd/core", "scripts/ralph/prd-261.json", "DUMPING AREA", "HANDOFF",
  "phase-bc-plan",
];
const FORBIDDEN_PATTERNS = [/\bGerard\b/, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/];
const LINK = /\]\(([^)\s]+)\)/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#)/i;
const CLI_COMMAND = /\bautomatos-theme[ \t]+([a-z][\w-]*)/g;
const INDEX_ROW = /^\| \[([^\]]+)\]\(([^)]+)\) \|/;

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** The skill folders under skills/. */
function skillFolders(): string[] {
  return readdirSync(join(ROOT, SKILLS), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Every Markdown file under skills/, repo-relative, the index included. */
function skillMarkdown(): string[] {
  return readdirSync(join(ROOT, SKILLS), { recursive: true, encoding: "utf8" })
    .map((rel) => `${SKILLS}/${rel.split("\\").join("/")}`)
    .filter((rel) => rel.endsWith(".md") && statSync(join(ROOT, rel)).isFile())
    .sort();
}

/** The frontmatter's `key: value` lines, or null when the file has none. */
function frontmatter(text: string): Record<string, string> | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) return null;
  const pairs = text.slice(4, end).split("\n").map((line) => /^([a-z][\w-]*): (.*)$/.exec(line));
  if (pairs.some((pair) => pair === null)) return null;
  return Object.fromEntries(pairs.map((pair) => [pair?.[1] ?? "", pair?.[2] ?? ""]));
}

/** Why `name` is not a valid skill name for `folder`, or null. */
function nameProblem(name: string | undefined, folder: string): string | null {
  if (name === undefined) return "no name";
  if (name !== folder) return `name "${name}" is not the folder "${folder}"`;
  if (!NAME_PATTERN.test(name) || name.length > NAME_MAX) return `name "${name}" breaks the skill name rule`;
  return RESERVED_NAME_WORDS.some((word) => name.includes(word)) ? `name "${name}" holds a reserved word` : null;
}

/** Why `description` is not a valid skill description, or null. */
function descriptionProblem(description: string | undefined): string | null {
  if (description === undefined || description.trim().length === 0) return "no description";
  if (description.length > DESCRIPTION_MAX) return `description is ${description.length} characters`;
  if (/[<>]/.test(description)) return "description holds a tag";
  return NOT_PLAIN_YAML.test(description) ? "description is not one plain YAML line" : null;
}

/** The index's rows: each skill it links, and the link. */
function indexRows(): { readonly name: string; readonly target: string }[] {
  return readText(INDEX).split("\n").flatMap((line) => {
    const row = INDEX_ROW.exec(line);
    return row === null ? [] : [{ name: row[1], target: row[2] }];
  });
}

/** Each relative link target of `file` that names no file or folder. */
function brokenLinks(file: string): string[] {
  return Array.from(readText(file).matchAll(LINK), (match) => match[1])
    .filter((target) => !EXTERNAL.test(target))
    .filter((target) => !existsSync(join(ROOT, normalize(join(dirname(file), target.split("#")[0])))));
}

/** The lines of every skill file holding `text`, as `file: line`. */
function linesWith(text: string): string[] {
  return skillMarkdown().flatMap((file) => readText(file).split("\n")
    .filter((line) => line.includes(text))
    .map((line) => `${file}: ${line}`));
}

/** True when `line` (`file: text`) is in a brand skill and every REST path on it is the brand kit's route. */
function brandKitLine(line: string): boolean {
  const inBrandSkill = BRAND_SKILLS.some((skill) => line.startsWith(`${SKILLS}/${skill}/`));
  return inBrandSkill && line.split(API_PREFIX).slice(1).every((rest) => `${API_PREFIX}${rest}`.startsWith(BRAND_KIT_ROUTE));
}

/** Every Markdown file of the brand skills. */
function brandSkillMarkdown(): string[] {
  return skillMarkdown().filter((file) => BRAND_SKILLS.some((skill) => file.startsWith(`${SKILLS}/${skill}/`)));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const builtCommands = COMMANDS
  .filter((command) => existsSync(fileURLToPath(new URL(command.module, CLI_MAIN))))
  .map((command) => command.name);

describe("the frontmatter reader", () => {
  it("reads key: value lines and refuses a file without frontmatter or with a line that is not one", () => {
    expect(frontmatter("---\nname: a\ndescription: b c\n---\n# A")).toEqual({ name: "a", description: "b c" });
    expect(frontmatter("# A\n")).toBeNull();
    expect(frontmatter("---\nname: a\n  more\n---\n")).toBeNull();
  });

  it("names a description that would not stay one plain YAML line", () => {
    expect(descriptionProblem("Use it: always")).not.toBeNull();
    expect(descriptionProblem("- a list")).not.toBeNull();
    expect(descriptionProblem("x".repeat(DESCRIPTION_MAX + 1))).not.toBeNull();
    expect(descriptionProblem("Build a theme - then check it.")).toBeNull();
  });
});

describe("every skill is an Agent Skill with a valid name and description", () => {
  const folders = skillFolders();

  it("found the skills", () => expect(folders.length).toBeGreaterThan(0));

  it.each(folders)("%s has a SKILL.md whose name is its folder and whose description is valid", (folder) => {
    const fields = frontmatter(readText(`${SKILLS}/${folder}/${SKILL_FILE}`));
    expect(fields).not.toBeNull();
    expect(nameProblem(fields?.name, folder)).toBeNull();
    expect(descriptionProblem(fields?.description)).toBeNull();
  });
});

describe("skills/README.md lists every skill once, and only skills that are there", () => {
  const rows = indexRows();
  const listed = rows.map((row) => row.name);

  it("has rows", () => expect(rows.length).toBeGreaterThan(0));

  it.each(skillFolders())("lists %s exactly once", (folder) => {
    expect(listed.filter((name) => name === folder)).toHaveLength(1);
  });
  it.each(rows)("row $name links its folder's SKILL.md, which is there", ({ name, target }) => {
    expect(target).toBe(`${name}/${SKILL_FILE}`);
    expect(existsSync(join(ROOT, SKILLS, target))).toBe(true);
  });
});

describe("every skill file links only to files that exist and names only built commands", () => {
  it.each(skillMarkdown())("%s: every relative link resolves", (file) => expect(brokenLinks(file)).toEqual([]));
  it.each(skillMarkdown())("%s: every automatos-theme command it names is built", (file) => {
    const commands = Array.from(readText(file).matchAll(CLI_COMMAND), (match) => match[1]);
    expect(commands.filter((command) => !builtCommands.includes(command))).toEqual([]);
  });
});

describe("no skill teaches what a theme may not do", () => {
  it.each(NEVER)("no skill names %s (the brand skills only the brand kit's route)", (text) => {
    expect(linesWith(text).filter((line) => text !== API_PREFIX || !brandKitLine(line))).toEqual([]);
  });

  it("the brand kit line rule takes the brand kit's routes in a brand skill, and nothing else", () => {
    const brand = `${SKILLS}/${BRAND_SKILLS[0]}/SKILL.md: `;
    expect(brandKitLine(`${brand}curl -sf ${LOCAL_BRAND_KIT}/logo -o logo.png`)).toBe(true);
    expect(brandKitLine(`${brand}curl ${LOCAL_BRAND_KIT} and /api/themes/import`)).toBe(false);
    expect(brandKitLine(`${SKILLS}/build-automatos-theme/SKILL.md: ${LOCAL_BRAND_KIT}`)).toBe(false);
  });

  it(`${STORAGE_WORD} appears only in ${STORAGE_SKILL}, on the lines of the rule that refuses it`, () => {
    const allowed = `${SKILLS}/${STORAGE_SKILL}/${SKILL_FILE}: `;
    const lines = linesWith(STORAGE_WORD);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => !line.startsWith(allowed) || !line.includes(STORAGE_RULE))).toEqual([]);
  });

  it(`${OLD_SKILL} appears on one line, the one that says it is superseded`, () => {
    const lines = linesWith(OLD_SKILL);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(SUPERSEDES);
    expect(existsSync(join(ROOT, SKILLS, OLD_SKILL))).toBe(false);
  });

  it.each(skillMarkdown())("%s names no local path, planning file or person", (file) => {
    const text = readText(file);
    expect(FORBIDDEN_TEXT.filter((forbidden) => text.includes(forbidden))).toEqual([]);
    expect(FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(text)).map(String)).toEqual([]);
  });
});

describe("the brand skills read the brand kit from the local edition or a file, never a hosted address or a token (E2)", () => {
  it.each(BRAND_SKILLS)("%s names the local edition's brand kit route and the brief's file flag", (skill) => {
    const text = readText(`${SKILLS}/${skill}/${SKILL_FILE}`);
    expect(text).toContain(LOCAL_BRAND_KIT);
    expect(text).toContain("automatos-theme brief --brand-kit ");
  });

  it("found the brand skills' files", () => expect(brandSkillMarkdown().length).toBeGreaterThanOrEqual(BRAND_SKILLS.length));

  it.each(brandSkillMarkdown())("%s names only local addresses", (file) => {
    const urls = Array.from(readText(file).matchAll(URL_LIKE), (match) => match[0]);
    expect(urls.filter((url) => !LOCAL_HOSTS.includes(hostOf(url) ?? ""))).toEqual([]);
  });

  it.each(brandSkillMarkdown())("%s names no token or credential header", (file) => {
    const text = readText(file);
    expect(CREDENTIALS.filter((credential) => text.includes(credential))).toEqual([]);
  });
});
