// PRD-261 B-01b: the guides (guides/*.md) are held to the code they describe. contract.md names every slot id, every
// page a theme may replace (and the core files a clone copies) and every host-owned route, as core's contract.py lists
// them (packages/theme-cli/src/core/data/contract.json, itself held to the vendored validator and its README's
// sha256); it documents the theme.json `mobile` block field by field. page-inventory.md names every core page file of
// core-pages.json, sdk.md every name of sdk-surface.json (storage included), and looks.md both knob kinds of core's
// look validator and no other. mobile-skins.md, the phone skin's guide, names every field, scheme, font role, mascot
// mode and token of the block, and its contrast table is the vendored validator's ten pairs, each at its minimum.
// Every relative link resolves, every `automatos-theme <command>` named is a command the CLI has built, and no guide
// names a local path, a planning file or a person.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMMANDS } from "../packages/theme-cli/src/cli-main.ts";
import { MOBILE_AA_TEXT, MOBILE_AA_UI, MOBILE_CONTRAST_PAIRS } from "../packages/theme-cli/src/core/mobile-manifest.ts";
import {
  HOST_OWNED_ROUTES, KNOWN_SLOTS, PAGE_SOURCES, REQUIRED_SLOTS, RESERVED_HTML_CLASSES,
} from "../packages/theme-cli/src/core/package-manifest.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GUIDES = "guides";
const GUIDE_FILES = [
  "README.md", "contract.md", "page-inventory.md", "mascot-placement.md", "mobile-skins.md", "looks.md", "sdk.md",
  "pitfalls.md",
];
const CORE_DIR = "packages/theme-cli/src/core";
const CONTRACT_JSON = `${CORE_DIR}/data/contract.json`;
const CORE_PAGES_JSON = `${CORE_DIR}/data/core-pages.json`;
const SDK_SURFACE_JSON = `${CORE_DIR}/data/sdk-surface.json`;
const CORE_README = `${CORE_DIR}/README.md`;
const LOOK_SCHEMA_TS = `${CORE_DIR}/look-schema.ts`;
const SDK_HOST_TYPES = "packages/theme-sdk/internal/host.d.ts";
/** The core module that teaches the vendored reader the `mobile` block (PRD-261 M-05 vendors it). */
const MOBILE_READER = `${CORE_DIR}/mobile-manifest.ts`;
const CLI_MAIN = new URL("../packages/theme-cli/src/cli-main.ts", import.meta.url);

// The `mobile` block's names as core holds them at main b9d25e1b8 (services/themes/mobile_manifest.py MOBILE_FIELDS
// and MOBILE_SCHEMES; contract.py MOBILE_FONT_ROLES, MOBILE_MASCOT_MODES and MOBILE_TOKEN_NAMES). The kit's vendored
// validators predate the block, so the names are written here, as the guide's spec.
const MOBILE_FIELDS = ["tokens", "fromLooks", "fonts", "mascot"];
const MOBILE_SCHEMES = ["light", "dark"];
const MOBILE_FONT_ROLES = ["sans", "serif", "mono"];
const MOBILE_MASCOT_MODES = ["clips", "stills", "none"];
const MOBILE_TOKEN_NAMES = [
  "--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground", "--primary",
  "--primary-foreground", "--secondary", "--secondary-foreground", "--muted", "--muted-foreground", "--accent",
  "--accent-foreground", "--destructive", "--destructive-foreground", "--border", "--input", "--ring",
  "--background-gradient-from", "--background-gradient-to", "--glass-border-hover", "--cc-hover", "--cc-hover-border",
];
const MOBILE_HEADING = "## The `mobile` block";
// contract.md's htmlClass row, and the sentence in it naming the classes the host keeps.
const HTML_CLASS_ROW = "| `htmlClass` |";
const HOST_KEEPS = /The host keeps ([^;|]+);/;
const MOBILE_PREDATES = /vendored reader predates the `mobile` block/;
// mobile-skins.md's contrast table: one row per pair, `| \`<text>\` on \`<ground>\` | <kind> | <minimum>:1 |`.
const PAIR_ROW = /^\| `(--[a-z-]+)` on `(--[a-z-]+)` \| (text|UI mark) \| ([0-9.]+):1 \|$/;
const PAIR_KIND_WORDS: Readonly<Record<string, string>> = { text: "text", ui: "UI mark" };

// Local paths, planning files and people a public guide must never name (docs.test.ts holds the same paths for every
// tracked doc; these add the local and planning ones a guide written from the plans could pick up).
const FORBIDDEN_TEXT = [
  "/Users/", "/home/", ".claude/", ".worktrees", "docs/prd/core", "scripts/ralph/prd-261.json", "DUMPING AREA", "HANDOFF",
  "phase-bc-plan",
];
const FORBIDDEN_PATTERNS = [/\bGerard\b/, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/];
const LINK = /\]\(([^)\s]+)\)/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#)/i;
const CLI_COMMAND = /\bautomatos-theme[ \t]+([a-z][\w-]*)/g;

interface ContractData {
  readonly KNOWN_SLOTS: readonly string[];
  readonly REQUIRED_SLOTS: readonly string[];
  readonly PAGE_SOURCES: Readonly<Record<string, readonly string[]>>;
  readonly HOST_OWNED_ROUTES: readonly string[];
}

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function guide(name: string): string {
  return readText(`${GUIDES}/${name}`);
}

function readJson<T>(rel: string): T {
  return JSON.parse(readText(rel)) as T;
}

const named = (text: string, name: string): boolean => text.includes(`\`${name}\``);
const sha256 = (rel: string): string => createHash("sha256").update(readFileSync(join(ROOT, rel))).digest("hex");

/** The quoted strings of one TypeScript declaration that starts at `start` and ends at `end`, or null when absent. */
function quotedIn(text: string, start: string, end: string): string[] | null {
  const from = text.indexOf(start);
  if (from < 0) return null;
  const to = text.indexOf(end, from + start.length);
  const body = text.slice(from + start.length, to < 0 ? undefined : to);
  return Array.from(body.matchAll(/'([^']+)'/g), (match) => match[1]);
}

/** The text of the section that starts at `heading`, up to the next heading of the same level. */
function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`${heading}\n`);
  if (start < 0) throw new Error(`no "${heading}" section`);
  const end = text.indexOf("\n## ", start + heading.length);
  return text.slice(start, end < 0 ? undefined : end);
}

/** Each relative link target of `file` (a path under the repo) that names no file or folder. */
function brokenLinks(file: string): string[] {
  const text = readText(file);
  return Array.from(text.matchAll(LINK), (match) => match[1])
    .filter((target) => !EXTERNAL.test(target))
    .filter((target) => !existsSync(join(ROOT, normalize(join(dirname(file), target.split("#")[0])))));
}

/** The commands the CLI has built: a row of COMMANDS whose module is there. */
function builtCommands(): string[] {
  return COMMANDS.filter((command) => existsSync(fileURLToPath(new URL(command.module, CLI_MAIN)))).map((command) => command.name);
}

const contract = readJson<ContractData>(CONTRACT_JSON);

describe("contract.json is core's lists, as the vendored validator holds them", () => {
  it("equals package-manifest.ts's KNOWN_SLOTS, REQUIRED_SLOTS, PAGE_SOURCES and HOST_OWNED_ROUTES", () => {
    expect(contract.KNOWN_SLOTS).toEqual([...KNOWN_SLOTS]);
    expect(contract.REQUIRED_SLOTS).toEqual([...REQUIRED_SLOTS]);
    expect(contract.PAGE_SOURCES).toEqual(Object.fromEntries(Object.entries(PAGE_SOURCES).map(([route, files]) => [route, [...files]])));
    expect(contract.HOST_OWNED_ROUTES).toEqual([...HOST_OWNED_ROUTES]);
  });

  it("its slot ids are the SDK's SlotId type", () => {
    const slotIds = quotedIn(readText(SDK_HOST_TYPES), "export type SlotId =", "\n\n");
    expect(slotIds).not.toBeNull();
    expect([...(slotIds ?? [])].sort()).toEqual([...contract.KNOWN_SLOTS].sort());
  });

  it("has the sha256 its row in src/core/README.md names, and names the README's commit", () => {
    const readme = readText(CORE_README);
    const row = readme.split("\n").find((line) => line.startsWith("| `data/contract.json` |"));
    expect(row?.match(/`([0-9a-f]{64})`/)?.[1]).toBe(sha256(CONTRACT_JSON));
    const commit = /^Source: `AutomatosAI\/automatos-ai` at `([0-9a-f]{40})`/m.exec(readme)?.[1];
    expect(commit).toBeDefined();
    expect(readJson<{ _comment: string }>(CONTRACT_JSON)._comment).toContain(commit ?? "no commit");
  });
});

describe("contract.md names every slot, page and host-owned route", () => {
  const text = guide("contract.md");
  const routes = Object.keys(contract.PAGE_SOURCES);
  const files = Object.values(contract.PAGE_SOURCES).flat();

  it.each(contract.KNOWN_SLOTS)("names the slot %s", (slot) => expect(named(text, slot)).toBe(true));
  it.each(routes)("names the page %s", (route) => expect(named(text, route)).toBe(true));
  it.each(files)("names the core file %s a clone copies", (file) => expect(named(text, file)).toBe(true));
  it.each(contract.HOST_OWNED_ROUTES)("names the host-owned route %s", (route) => expect(named(text, route)).toBe(true));
});

describe("contract.md names the htmlClass names the host keeps", () => {
  it("lists exactly the vendored validator's RESERVED_HTML_CLASSES, in its order", () => {
    const row = guide("contract.md").split("\n").find((line) => line.startsWith(HTML_CLASS_ROW)) ?? "";
    const kept = HOST_KEEPS.exec(row)?.[1] ?? "";
    expect(Array.from(kept.matchAll(/`([a-z][a-z0-9-]*)`/g), (match) => match[1])).toEqual([...RESERVED_HTML_CLASSES]);
  });
});

describe("contract.md documents the theme.json mobile block", () => {
  const section = sectionOf(guide("contract.md"), MOBILE_HEADING);
  const names = [...MOBILE_FIELDS, ...MOBILE_SCHEMES, ...MOBILE_FONT_ROLES, ...MOBILE_MASCOT_MODES, ...MOBILE_TOKEN_NAMES];

  it.each(names)("its mobile section names %s", (name) => expect(named(section, name)).toBe(true));

  it("says whether the kit's vendored reader takes the block, as src/core is now", () => {
    if (existsSync(join(ROOT, MOBILE_READER))) expect(section).not.toMatch(MOBILE_PREDATES);
    else expect(section).toMatch(MOBILE_PREDATES);
  });
});

describe("mobile-skins.md teaches the block and its contrast pairs as the vendored validator holds them", () => {
  const text = guide("mobile-skins.md");
  const names = [...MOBILE_FIELDS, ...MOBILE_SCHEMES, ...MOBILE_FONT_ROLES, ...MOBILE_MASCOT_MODES, ...MOBILE_TOKEN_NAMES];
  const rows = text.split("\n").flatMap((line) => {
    const row = PAIR_ROW.exec(line);
    return row === null ? [] : [[row[1], row[2], row[3], Number(row[4])] as const];
  });
  const expected = MOBILE_CONTRAST_PAIRS.map(([foreground, background, kind]) => (
    [foreground, background, PAIR_KIND_WORDS[kind], kind === "text" ? MOBILE_AA_TEXT : MOBILE_AA_UI] as const
  ));

  it.each(names)("names %s", (name) => expect(named(text, name)).toBe(true));
  it("its contrast table is the ten pairs, in the validator's order, each with its kind and minimum", () => {
    expect(MOBILE_CONTRAST_PAIRS).toHaveLength(10);
    expect(rows).toEqual(expected);
  });
});

describe("page-inventory.md names every core page file and route", () => {
  const text = guide("page-inventory.md");
  const pageFiles = Object.keys(readJson<{ files: Record<string, string> }>(CORE_PAGES_JSON).files);

  it("core-pages.json lists files", () => expect(pageFiles.length).toBeGreaterThan(0));
  it.each(pageFiles)("names %s", (file) => expect(named(text, file)).toBe(true));
  it.each(Object.keys(contract.PAGE_SOURCES))("has a section for %s", (route) => expect(text).toContain(`## \`${route}\``));
});

describe("sdk.md names every area and every name of the SDK's surface", () => {
  const text = guide("sdk.md");
  const areas = readJson<{ areas: Record<string, string[]> }>(SDK_SURFACE_JSON).areas;
  const names = Object.entries(areas).flatMap(([area, list]) => list.map((name): [string, string] => [area, name]));

  it("the surface has the storage area, with names", () => expect(areas.storage?.length ?? 0).toBeGreaterThan(0));
  it.each(Object.keys(areas))("names the area %s", (area) => expect(named(text, area)).toBe(true));
  it.each(names)("names %s.%s", (_area, name) => expect(named(text, name)).toBe(true));
});

describe("looks.md teaches both knob kinds and no other", () => {
  const text = guide("looks.md");
  const kinds = quotedIn(readText(LOOK_SCHEMA_TS), "const KNOB_KINDS: readonly string[] = [", "]") ?? [];
  const written = Array.from(text.matchAll(/"kind":\s*"([^"]*)"/g), (match) => match[1]);

  it("core's look validator has two kinds", () => expect(kinds).toEqual(["choice", "number"]));
  it.each(kinds)("shows a %s knob", (kind) => {
    expect(written).toContain(kind);
    expect(named(text, kind)).toBe(true);
  });
  it("every knob kind it writes is one of them", () => {
    expect(written.length).toBeGreaterThan(0);
    expect(written.filter((kind) => !kinds.includes(kind))).toEqual([]);
  });
});

describe("every guide links only to files that exist, names only built commands, and names no one", () => {
  const built = builtCommands();

  it("the guides folder holds the eight guides", () => {
    expect(readdirSync(join(ROOT, GUIDES)).filter((name) => name.endsWith(".md")).sort()).toEqual([...GUIDE_FILES].sort());
  });
  it.each(GUIDE_FILES)("%s: every relative link resolves", (name) => expect(brokenLinks(`${GUIDES}/${name}`)).toEqual([]));
  it.each(GUIDE_FILES)("%s: every automatos-theme command it names is built", (name) => {
    const commands = Array.from(guide(name).matchAll(CLI_COMMAND), (match) => match[1]);
    expect(commands.filter((command) => !built.includes(command))).toEqual([]);
  });
  it.each(GUIDE_FILES)("%s: names no local path, planning file or person", (name) => {
    const text = guide(name);
    expect(FORBIDDEN_TEXT.filter((forbidden) => text.includes(forbidden))).toEqual([]);
    expect(FORBIDDEN_PATTERNS.filter((pattern) => pattern.test(text)).map(String)).toEqual([]);
  });
});
