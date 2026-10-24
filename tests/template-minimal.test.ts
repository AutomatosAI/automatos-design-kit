// PRD-261 B-01e and B-03f: templates/minimal is a theme that already packs and passes check. `automatos-theme new
// acme/sample --template minimal` writes it into a temporary kit layout (themes/sample/), its placeholders filled; it
// is built with the kit's preset (scripts/review/rebuild.ts buildThemeFolder: the preset alone, from the theme
// folder), packed as `pack` packs it, and checked: `check` reports no error, and `check design` passes all three of
// its lines. The template itself
// registers the frame, the look editor and the style sheet (PA-14), ships its look schema and presets, imports nothing
// of core, keeps its source within 1,000 to 1,600 lines, and fills every placeholder it names. Its own tests (the
// look data, the screens) run on the harness: packages/theme-harness/test/template-minimal.test.tsx.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCheck } from "../packages/theme-cli/src/check/index.ts";
import { checkDesign } from "../packages/theme-cli/src/check/design.ts";
import { verdictOf } from "../packages/theme-cli/src/check/report.ts";
import { packTheme } from "../packages/theme-cli/src/pack.ts";
import { runNew } from "../packages/theme-cli/src/new/index.ts";
import {
  placeholdersIn, placeholderValues, readFolder, TEMPLATE_FILE, themeNames,
} from "../packages/theme-cli/src/new/placeholders.ts";
import { buildThemeFolder } from "../scripts/review/rebuild.ts";

const TEMPLATE = fileURLToPath(new URL("../templates/minimal/", import.meta.url));
const THEME_ID = "acme/sample";
const ENTRY = "src/entry.ts";
const SLOTS = ["frame@1", "lookEditor@1", "styleSheet@1"];
const SOURCE_LINES = { min: 1_000, max: 1_600 };
const CORE_IMPORT = /\bfrom\s*['"](?:@\/|next\/)|\bimport\s*\(\s*['"](?:@\/|next\/)/;
/** Building the template's source with Vite on a cold runner, then packing and checking it twice. */
const BUILD_TIMEOUT_MS = 120_000;

interface Ran {
  readonly code: number;
  readonly out: readonly string[];
  readonly err: readonly string[];
}

interface Made {
  readonly themeDir: string;
  readonly made: Ran;
  readonly packed: ReturnType<typeof packTheme>;
  readonly check: Ran;
  readonly checkJson: Ran;
}

const folders: string[] = [];
let made: Made;

async function ranCheck(argv: readonly string[]): Promise<Ran> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCheck(argv, { out: (line) => out.push(line), err: (line) => err.push(line) }, process.cwd());
  return { code, out, err };
}

/** `new acme/sample --template minimal`, run from a temporary folder, then built, packed and checked. */
async function makeSample(): Promise<Made> {
  const root = mkdtempSync(join(tmpdir(), "automatos-template-minimal-"));
  folders.push(root);
  const out: string[] = [];
  const err: string[] = [];
  const code = runNew(["new", THEME_ID, "--template", "minimal"], { out: (line) => out.push(line), err: (line) => err.push(line) }, root);
  const themeDir = join(root, "themes", "sample");
  if (code !== 0) return { themeDir, made: { code, out, err }, packed: { ok: false, errors: [] }, check: { code, out, err }, checkJson: { code, out, err } };
  await buildThemeFolder(themeDir, ENTRY);
  const packed = packTheme(themeDir, join(root, "out"));
  const check = await ranCheck(["check", themeDir]);
  return { themeDir, made: { code, out, err }, packed, check, checkJson: await ranCheck(["check", themeDir, "--json"]) };
}

const templateText = (path: string): string => readFileSync(join(TEMPLATE, path), "utf8");

beforeAll(async () => {
  made = await makeSample();
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
});

describe("the minimal template, made into acme/sample", () => {
  it("is written by `new`, which says so", () => {
    expect([made.made.code, made.made.err]).toEqual([0, []]);
    expect(made.made.out[0]).toBe(`${made.themeDir}: ${THEME_ID} from the minimal template, ${readFolder(TEMPLATE).length} files.`);
  });

  it("builds and packs as acme.sample-0.1.0.autotheme", () => {
    const packed = made.packed;
    if (!packed.ok) throw new Error(packed.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join("\n"));
    expect(packed.file.endsWith("acme.sample-0.1.0.autotheme")).toBe(true);
    expect(packed.warnings).toEqual([]);
  });

  it("passes check with no error, the source's JS rules and SDK uses included", () => {
    expect(made.check.out.filter((line) => /^\S+\s+error\s/.test(line))).toEqual([]);
    expect(made.check.code).toBe(0);
    const report = JSON.parse(made.checkJson.out.join("\n")) as { checks: Record<string, { level: string; unknownNames?: unknown }> };
    expect(Object.values(report.checks).map((check) => check.level)).not.toContain("error");
    expect([report.checks.jsRules.level, report.checks.uses.level]).toEqual(["pass", "pass"]);
  });

  it("passes check design: its looks, its first-paint table and every declared colour pair on both presets", async () => {
    const result = await checkDesign(made.themeDir);
    expect(result.rows.map((row) => [row.name, row.level, row.errors])).toEqual([
      ["looks", "pass", []], ["prepaint", "pass", []], ["contrast", "pass", []],
    ]);
    expect(verdictOf(Object.fromEntries(result.rows.map((row) => [row.name, { level: row.level }])))).toBe("pass");
    expect(new Set(result.measures.map((item) => item.preset))).toEqual(new Set(["day", "night"]));
  });

  it("leaves no placeholder unfilled in the files it copied", () => {
    const copied = readFolder(made.themeDir).filter((file) => !file.path.startsWith("dist/"));
    const left = copied.filter((file) => placeholdersIn(new TextDecoder().decode(file.data)).length > 0);
    expect(left.map((file) => file.path)).toEqual([]);
  });
});

describe("the minimal template itself", () => {
  const files = readFolder(TEMPLATE);
  const source = files.filter((file) => file.path.startsWith("src/"));

  it("declares and registers the frame, the look editor and the style sheet (PA-14)", () => {
    const manifest = JSON.parse(templateText("theme.json")) as { slots: string[]; look: string };
    expect(manifest.slots).toEqual(expect.arrayContaining(SLOTS));
    SLOTS.forEach((slot) => expect(templateText(ENTRY)).toContain(`host.registerSlot('${slot}', `));
    expect(readdirSync(join(TEMPLATE, "looks", "presets"))).toContain(`${manifest.look}.look.json`);
    expect(files.map((file) => file.path)).toEqual(expect.arrayContaining(["looks/schema.json", "boot/prepaint.json", "design/contrast.json"]));
  });

  it(`keeps its source within ${SOURCE_LINES.min} to ${SOURCE_LINES.max} lines, importing nothing of core`, () => {
    const lines = source.reduce((sum, file) => sum + new TextDecoder().decode(file.data).split("\n").length - 1, 0);
    expect(lines).toBeGreaterThanOrEqual(SOURCE_LINES.min);
    expect(lines).toBeLessThanOrEqual(SOURCE_LINES.max);
    expect(source.filter((file) => CORE_IMPORT.test(new TextDecoder().decode(file.data))).map((file) => file.path)).toEqual([]);
  });

  it(`fills only the placeholders ${TEMPLATE_FILE} names, and names each one it fills`, () => {
    const declared = (JSON.parse(templateText(TEMPLATE_FILE)) as { placeholders: string[] }).placeholders;
    const used = new Set(files.flatMap((file) => placeholdersIn(new TextDecoder().decode(file.data))));
    expect(Array.from(used).sort()).toEqual([...declared].sort());
    expect(Object.keys(placeholderValues(themeNames(THEME_ID))).sort()).toEqual([...declared].sort());
  });

  it("names the kit's own build tools at the versions Play names them", () => {
    type Manifest = { devDependencies: Record<string, string>; peerDependencies: Record<string, string> };
    const play = JSON.parse(readFileSync(fileURLToPath(new URL("../themes/play/package.json", import.meta.url)), "utf8")) as Manifest;
    const template = JSON.parse(templateText("package.json")) as Manifest;
    expect([template.devDependencies, template.peerDependencies]).toEqual([play.devDependencies, play.peerDependencies]);
  });
});
