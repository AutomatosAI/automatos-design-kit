// PRD-261 B-03f: `automatos-theme new acme/bright --template full` is Play de-branded, with and without
// `--mascot none`. Each is written into a temporary kit layout (themes/bright/, beside copies of the kit packages
// it bundles, packages/look-kit and packages/mascot, as the kit lays them out), built with the kit's preset alone,
// packed and checked: no error. Nothing of Play's brand is left where it would show or clash: no html.play rule, no
// play- keyframe, font or class, no automatos/play, in the files or the built stylesheet. With --mascot none there is
// no clip, no mascot block and no @automatos/mascot, and the theme still builds. themes/play is as it was.
// PRD-261 B-01f: both declare /agents a clone, at the vendored core-pages.json's sha of the core file it copies, and
// check passes it at clonedFrom; one hex digit off, it is a warning there. The clone's own test, on the harness, is
// templates/full/code/test/agents-page.test.tsx (run by packages/theme-harness/test/template-full.test.tsx).
// Each theme's own style sheet data runs too, from its folder: its look code names every variable it makes with the
// theme's prefix, so the colours, contrast lines, Copy tokens block and Auto's ring colours are Play's, renamed.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCheck } from "../packages/theme-cli/src/check/index.ts";
import { runNew } from "../packages/theme-cli/src/new/index.ts";
import { readFolder, type FolderFile } from "../packages/theme-cli/src/new/placeholders.ts";
import { packTheme } from "../packages/theme-cli/src/pack.ts";
import { RING_VARS } from "../packages/mascot/src/ring.ts";
import { buildThemeFolder } from "../scripts/review/rebuild.ts";
import { RING_LOOK_VARS } from "../templates/full/code/src/lib/looks/ring-vars.ts";
import { DEFAULT_LOOK as PLAY_LOOK } from "../themes/play/src/lib/looks/presets.ts";
import * as playStyle from "../themes/play/src/lib/looks/style.ts";
import type { Look } from "../themes/play/src/lib/looks/types.ts";

const KIT = fileURLToPath(new URL("..", import.meta.url));
const THEME_ID = "acme/bright";
const ENTRY = "src/entry.ts";
const KIT_PACKAGES = ["look-kit", "mascot"];
const MASCOT_PACKAGE = "@automatos/mascot";
/** Play's brand where it would show or clash: its class's rules, a name under its class's prefix, its id. */
const BRAND = [/html\.play(?![a-z0-9-])/, /(?<![A-Za-z0-9_-])play-/, /automatos\/play/, /@automatos\/theme-play/];
const CORE_PAGES = fileURLToPath(new URL("../packages/theme-cli/src/core/data/core-pages.json", import.meta.url));
const AGENTS_ROUTE = "/agents";
const MASCOT_IMPORT = /\bfrom\s*['"]@automatos\/mascot|\bimport\s*\(\s*['"]@automatos\/mascot/;
/** Play's look variables' prefix, and the theme's. */
const PLAY_VARS = /--pl-/g;
const THEME_VARS = "--bright-";
/** Two builds of a Play-sized theme with Vite on a cold runner, each packed and checked. */
const BUILD_TIMEOUT_MS = 300_000;

interface Ran {
  readonly code: number;
  readonly out: readonly string[];
  readonly err: readonly string[];
}

interface Made {
  readonly themeDir: string;
  readonly made: Ran;
  readonly files: readonly FolderFile[];
  readonly packed: ReturnType<typeof packTheme>;
  readonly check: Ran;
}

const folders: string[] = [];
const decoder = new TextDecoder();
let withMascot: Made;
let noMascot: Made;
let playBefore: ReadonlyMap<string, string>;

function collected(): { readonly output: { out: (line: string) => void; err: (line: string) => void }; readonly lines: { out: string[]; err: string[] } } {
  const lines = { out: [] as string[], err: [] as string[] };
  return { output: { out: (line) => lines.out.push(line), err: (line) => lines.err.push(line) }, lines };
}

/** A temporary folder laid out as the kit lays a theme out: the kit packages a theme bundles, at packages/<name>/. */
function kitLayout(): string {
  const root = mkdtempSync(join(tmpdir(), "automatos-template-full-"));
  folders.push(root);
  KIT_PACKAGES.forEach((name) => {
    mkdirSync(join(root, "packages", name), { recursive: true });
    cpSync(join(KIT, "packages", name, "package.json"), join(root, "packages", name, "package.json"));
    cpSync(join(KIT, "packages", name, "src"), join(root, "packages", name, "src"), { recursive: true });
  });
  return root;
}

async function ranCheck(themeDir: string): Promise<Ran> {
  const { output, lines } = collected();
  const code = await runCheck(["check", themeDir, "--json"], output, process.cwd());
  return { code, ...lines };
}

/** `new acme/bright --template full` (with `extra`), then built, packed and checked as an author would. */
async function makeBright(extra: readonly string[]): Promise<Made> {
  const root = kitLayout();
  const themeDir = join(root, "themes", "bright");
  const { output, lines } = collected();
  const code = runNew(["new", THEME_ID, "--template", "full", ...extra], output, root);
  const made = { code, ...lines };
  if (code !== 0) return { themeDir, made, files: [], packed: { ok: false, errors: [] }, check: made };
  const files = readFolder(themeDir);
  await buildThemeFolder(themeDir, ENTRY);
  const packed = packTheme(themeDir, join(root, "out"));
  return { themeDir, made, files, packed, check: await ranCheck(themeDir) };
}

/** Every file git tracks under themes/play, with its sha256. */
function playFiles(): Map<string, string> {
  const paths = execFileSync("git", ["ls-files", "-z", "themes/play"], { cwd: KIT, encoding: "utf8" }).split("\0").filter(Boolean);
  return new Map(paths.map((path) => [path, createHash("sha256").update(readFileSync(join(KIT, path))).digest("hex")]));
}

const textOf = (made: Made, path: string): string => decoder.decode(made.files.find((file) => file.path === path)?.data);
const jsonOf = <T>(made: Made, path: string): T => JSON.parse(textOf(made, path)) as T;
const isText = (path: string): boolean => /\.(?:tsx?|jsx?|css|json|md|txt)$|(?:^|\/)(?:NOTICE|\.gitignore)$/.test(path);

/**
 * Each of the theme's own files, and its built stylesheet, where one of BRAND still stands. The built scripts are
 * left to the theme's source: they hold the kit packages it bundles too, whose own comments name Play's files.
 */
function brandLeft(made: Made): string[] {
  const css = { path: "dist/theme.css", data: new Uint8Array(readFileSync(join(made.themeDir, "dist", "theme.css"))) };
  return [...made.files, css].filter((file) => isText(file.path)).flatMap((file) => {
    const text = decoder.decode(file.data);
    return BRAND.flatMap((pattern) => (pattern.test(text) ? [`${file.path}: ${String(pattern)}`] : []));
  });
}

interface Report {
  readonly verdict: string;
  readonly checks: Record<string, { level: string; [field: string]: unknown }>;
}

interface ClonePage {
  readonly mode: string;
  readonly keepCorePage: readonly string[];
  readonly clonedFrom: { readonly path: string; readonly sha: string };
}

type Manifest = { pages: Record<string, ClonePage> } & Record<string, unknown>;

const reportOf = (ran: Ran): Report => JSON.parse(ran.out.join("\n")) as Report;

type StyleModule = Pick<typeof playStyle, "colourSwatches" | "contrastChecks" | "rootBlock" | "mascotSlots">;

/** What a style sheet draws for a look: its colours, its contrast lines, its Copy tokens block and Auto's rings. */
function styleData(style: StyleModule, look: Look): unknown[] {
  return [style.colourSwatches(look), style.contrastChecks(look), style.rootBlock(look), style.mascotSlots(look)];
}

/** `value` with each of Play's variables named as the theme's. */
const renamedVars = (value: unknown): unknown => JSON.parse(JSON.stringify(value).replace(PLAY_VARS, THEME_VARS)) as unknown;

/**
 * The theme's own look code, run from its folder: its src/lib/looks/style.ts and its default look. The kit packages
 * they import by name resolve as in the kit, through node_modules links to kitLayout's copies (the theme's
 * tsconfig.json holds the kit's compiler options itself, as new writes it; the base is copied beside it all the
 * same). Made after the build, pack and check, which ran without the links.
 */
async function themeLooks(made: Made): Promise<{ readonly style: StyleModule; readonly look: Look }> {
  const root = join(made.themeDir, "..", "..");
  const scope = join(root, "node_modules", "@automatos");
  mkdirSync(scope, { recursive: true });
  KIT_PACKAGES.filter((name) => !existsSync(join(scope, name)))
    .forEach((name) => symlinkSync(join(root, "packages", name), join(scope, name), "dir"));
  cpSync(join(KIT, "tsconfig.base.json"), join(root, "tsconfig.base.json"));
  const looks = join(made.themeDir, "src", "lib", "looks");
  const style = (await import(join(looks, "style.ts"))) as StyleModule;
  const { DEFAULT_LOOK } = (await import(join(looks, "presets.ts"))) as { readonly DEFAULT_LOOK: Look };
  return { style, look: DEFAULT_LOOK };
}

function checkLevels(made: Made): Record<string, string> {
  return Object.fromEntries(Object.entries(reportOf(made.check).checks).map(([name, entry]) => [name, entry.level]));
}

beforeAll(async () => {
  playBefore = playFiles();
  withMascot = await makeBright([]);
  noMascot = await makeBright(["--mascot", "none"]);
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
});

/** Each theme the tests made, read once beforeAll has made it. */
const VARIANTS: Array<[string, () => Made]> = [
  ["with Auto", () => withMascot],
  ["with --mascot none", () => noMascot],
];

describe.each(VARIANTS)("new acme/bright --template full, %s", (_label, madeOf) => {
  it("is written by new, and builds and packs as acme.bright-0.1.0.autotheme", () => {
    const made = madeOf();
    expect([made.made.code, made.made.err]).toEqual([0, []]);
    const packed = made.packed;
    if (!packed.ok) throw new Error(packed.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join("\n"));
    expect(packed.file.endsWith("acme.bright-0.1.0.autotheme")).toBe(true);
  });

  it("passes check with no error", () => {
    const made = madeOf();
    expect(Object.entries(checkLevels(made)).filter(([, level]) => level === "error")).toEqual([]);
    expect(made.check.code).toBe(0);
  });

  it("keeps nothing of Play's brand in its files or stylesheet: no html.play, no play- keyframe, font or class, no automatos/play", () => {
    const made = madeOf();
    expect(brandLeft(made)).toEqual([]);
    expect(readFileSync(join(made.themeDir, "dist", "theme.css"), "utf8")).toMatch(/@keyframes bright-/);
  });

  it("is acme/bright in theme.json and package.json, at its first version, with no previews or phone screenshots of Play's", () => {
    const made = madeOf();
    const manifest = jsonOf<Record<string, unknown>>(made, "theme.json");
    expect([manifest.id, manifest.name, manifest.version, manifest.htmlClass]).toEqual([THEME_ID, "Bright", "0.1.0", "bright"]);
    expect(manifest.previews).toBeUndefined();
    expect(manifest.phonePreviews).toBeUndefined();
    expect(made.files.some((file) => file.path.startsWith("assets/previews/"))).toBe(false);
    const pkg = jsonOf<{ name: string; scripts: Record<string, string> }>(made, "package.json");
    expect([pkg.name, pkg.scripts.build]).toEqual(["@acme/theme-bright", "vite build"]);
  });

  it("draws its style sheet from the variables its own look code makes: Play's data, renamed, Auto's rings too", async () => {
    const made = madeOf();
    expect(textOf(made, "src/lib/looks/engine.ts")).toContain("const BRIGHT_VAR_PREFIX = 'bright'");
    const theme = await themeLooks(made);
    expect(styleData(theme.style, theme.look)).toEqual(renamedVars(styleData(playStyle, PLAY_LOOK)));
  });
});

describe("the mascot", () => {
  it("has, in Play's words, the ring's look variable for each tone that @automatos/mascot names, renamed with the rest", () => {
    expect(RING_LOOK_VARS).toEqual(RING_VARS);
  });

  it("is Auto's, clips and all, unless --mascot none", () => {
    const manifest = jsonOf<{ mascot?: unknown; mobile: Record<string, unknown> }>(withMascot, "theme.json");
    expect([manifest.mascot !== undefined, manifest.mobile.mascot]).toEqual([true, "clips"]);
    expect(withMascot.files.filter((file) => file.path.startsWith("assets/mascot/")).length).toBeGreaterThan(0);
    expect(jsonOf<{ dependencies: Record<string, string> }>(withMascot, "package.json").dependencies).toHaveProperty([MASCOT_PACKAGE]);
  });

  it("with --mascot none: no clips, no mascot block, no @automatos/mascot, and nothing imports it", () => {
    const manifest = jsonOf<{ mascot?: unknown; mobile: Record<string, unknown> }>(noMascot, "theme.json");
    expect([manifest.mascot, manifest.mobile.mascot]).toEqual([undefined, undefined]);
    expect(noMascot.files.filter((file) => file.path.startsWith("assets/mascot/") || file.path === "NOTICE")).toEqual([]);
    expect(jsonOf<{ dependencies: Record<string, string> }>(noMascot, "package.json").dependencies).not.toHaveProperty([MASCOT_PACKAGE]);
    const importing = noMascot.files.filter((file) => file.path.startsWith("src/") && MASCOT_IMPORT.test(decoder.decode(file.data)));
    expect(importing.map((file) => file.path)).toEqual([]);
    const packed = noMascot.packed;
    if (!packed.ok) throw new Error("the theme with no mascot must pack");
    expect(Object.keys(packed.manifest.files).filter((path) => path.startsWith("source/packages/mascot/"))).toEqual([]);
  });
});

describe("the /agents clone", () => {
  const core = JSON.parse(readFileSync(CORE_PAGES, "utf8")) as { files: Record<string, string> };

  it.each(VARIANTS)("%s: is a clone at the vendored core-pages.json's sha, read through pages/agents, and check passes it", (_label, madeOf) => {
    const made = madeOf();
    const page = jsonOf<Manifest>(made, "theme.json").pages[AGENTS_ROUTE];
    expect([page.mode, page.keepCorePage]).toEqual(["clone", ["tab", "agent", "panel"]]);
    expect(page.clonedFrom.sha).toBe(core.files[page.clonedFrom.path]);
    const report = reportOf(made.check);
    expect(report.checks.clonedFrom).toMatchObject({ level: "pass", clones: [AGENTS_ROUTE], stale: [] });
    expect(report.checks.uses.usedAreas).toEqual(expect.arrayContaining(["pages-agents"]));
    expect(textOf(made, "src/entry.ts")).toContain(`host.registerPage('${AGENTS_ROUTE}', BrightAgents)`);
  });

  it("is a warning at clonedFrom once its sha is one hex digit off, naming the core file's sha", async () => {
    const path = join(noMascot.themeDir, "theme.json");
    const original = readFileSync(path, "utf8");
    const manifest = JSON.parse(original) as Manifest;
    const page = manifest.pages[AGENTS_ROUTE];
    const off = `${page.clonedFrom.sha.slice(0, -1)}${page.clonedFrom.sha.endsWith("0") ? "1" : "0"}`;
    const changed = { ...manifest, pages: { ...manifest.pages, [AGENTS_ROUTE]: { ...page, clonedFrom: { ...page.clonedFrom, sha: off } } } };
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`);
    try {
      const ran = await ranCheck(noMascot.themeDir);
      const report = reportOf(ran);
      expect(report.checks.clonedFrom).toMatchObject({
        level: "warning",
        clones: [AGENTS_ROUTE],
        stale: [{ route: AGENTS_ROUTE, path: page.clonedFrom.path, sha: off, releaseSha: page.clonedFrom.sha }],
      });
      expect([ran.code, report.verdict]).toEqual([0, "review_required"]);
    } finally {
      writeFileSync(path, original);
    }
  });
});

describe("themes/play", () => {
  it("is as it was: new reads Play and writes nothing of it", () => {
    expect(playFiles()).toEqual(playBefore);
    expect(existsSync(join(KIT, "themes", "bright"))).toBe(false);
  });
});
