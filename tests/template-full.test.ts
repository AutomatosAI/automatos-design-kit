// PRD-261 B-03f: `automatos-theme new acme/bright --template full` is Play de-branded, with and without
// `--mascot none`. Each is written into a temporary kit layout (themes/bright/, beside copies of the kit packages
// it bundles, packages/look-kit and packages/mascot, as the kit lays them out), built with the kit's preset alone,
// packed and checked: no error. Nothing of Play's brand is left where it would show or clash: no html.play rule, no
// play- keyframe, font or class, no automatos/play, in the files or the built stylesheet. With --mascot none there is
// no clip, no mascot block and no @automatos/mascot, and the theme still builds. themes/play is as it was.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCheck } from "../packages/theme-cli/src/check/index.ts";
import { runNew } from "../packages/theme-cli/src/new/index.ts";
import { readFolder, type FolderFile } from "../packages/theme-cli/src/new/placeholders.ts";
import { packTheme } from "../packages/theme-cli/src/pack.ts";
import { buildThemeFolder } from "../scripts/review/rebuild.ts";

const KIT = fileURLToPath(new URL("..", import.meta.url));
const THEME_ID = "acme/bright";
const ENTRY = "src/entry.ts";
const KIT_PACKAGES = ["look-kit", "mascot"];
const MASCOT_PACKAGE = "@automatos/mascot";
/** Play's brand where it would show or clash: its class's rules, a name under its class's prefix, its id. */
const BRAND = [/html\.play(?![a-z0-9-])/, /(?<![A-Za-z0-9_-])play-/, /automatos\/play/, /@automatos\/theme-play/];
const MASCOT_IMPORT = /\bfrom\s*['"]@automatos\/mascot|\bimport\s*\(\s*['"]@automatos\/mascot/;
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

function checkLevels(made: Made): Record<string, string> {
  const report = JSON.parse(made.check.out.join("\n")) as { checks: Record<string, { level: string }> };
  return Object.fromEntries(Object.entries(report.checks).map(([name, entry]) => [name, entry.level]));
}

beforeAll(async () => {
  playBefore = playFiles();
  withMascot = await makeBright([]);
  noMascot = await makeBright(["--mascot", "none"]);
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
});

describe.each([
  ["with Auto", () => withMascot],
  ["with --mascot none", () => noMascot],
])("new acme/bright --template full, %s", (_label, madeOf) => {
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

  it("is acme/bright in theme.json and package.json, at its first version, with no previews of Play's", () => {
    const made = madeOf();
    const manifest = jsonOf<Record<string, unknown>>(made, "theme.json");
    expect([manifest.id, manifest.name, manifest.version, manifest.htmlClass]).toEqual([THEME_ID, "Bright", "0.1.0", "bright"]);
    expect(manifest.previews).toBeUndefined();
    expect(made.files.some((file) => file.path.startsWith("assets/previews/"))).toBe(false);
    const pkg = jsonOf<{ name: string; scripts: Record<string, string> }>(made, "package.json");
    expect([pkg.name, pkg.scripts.build]).toEqual(["@acme/theme-bright", "vite build"]);
  });
});

describe("the mascot", () => {
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

describe("themes/play", () => {
  it("is as it was: new reads Play and writes nothing of it", () => {
    expect(playFiles()).toEqual(playBefore);
    expect(existsSync(join(KIT, "themes", "bright"))).toBe(false);
  });
});
