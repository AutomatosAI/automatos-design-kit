// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACCENTS, GROUNDS, LIGHTS } from "@/lib/looks/catalogue";
import { baseTokens } from "@/lib/skins/base";
import { hexToTriplet, tripletContrast } from "@/lib/skins/colour";
import { EXAMPLE_SKINS, examplePreviewUrl, findExample, startFromHref } from "@/lib/skins/examples";
import { AA_TEXT_RATIO, CONTRAST_PAIRS, MASCOT_DIR, PREVIEW_MAX_BYTES, PREVIEW_PATH, type Skin } from "@/lib/skins/format";
import { draftFromSkin } from "@/lib/skins/model";
import { sniffType } from "@/lib/skins/sniff";
import { validateSkin } from "@/lib/skins/validate";
import { runPack } from "@/scripts/lib/pack-cli";
import { runValidate } from "@/scripts/lib/validate-cli";

// PRD-004 K-008: the four example skins in skins/. Each passes npm run validate and npm run pack,
// carries its preview picture, and says what the PRD asks of it.

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKINS = join(REPO, "skins");
const SLUGS = ["ember", "daylight", "workshop", "neon"] as const;
type Json = Record<string, unknown>;
/** Studio's own text aliases: the core doesn't pair them, so a skin may set the ground alone. */
const UNPAIRED_IN_CORE = new Set(["olive", "warn-ink"]);

function capture() {
  const log: string[] = [];
  const error: string[] = [];
  return { io: { log: (line: string) => log.push(line), error: (line: string) => error.push(line) }, log, error };
}

async function skinJson(slug: string): Promise<Json> {
  return JSON.parse(await readFile(join(SKINS, slug, "skin.json"), "utf8")) as Json;
}

/** The validated skin, as Studio reads it (preview included, with its real size). */
async function validated(slug: string, options: Parameters<typeof validateSkin>[2] = {}): Promise<Skin> {
  const bytes = new Uint8Array(await readFile(join(SKINS, slug, PREVIEW_PATH)));
  const result = validateSkin(await skinJson(slug), [{ path: PREVIEW_PATH, bytes: bytes.length, sniffedType: sniffType(bytes) }], options);
  if (!result.ok) throw new Error(`${slug}: ${JSON.stringify(result.errors)}`);
  return result.skin;
}

async function filesUnder(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? filesUnder(join(dir, entry.name), `${prefix}${entry.name}/`) : Promise.resolve([`${prefix}${entry.name}`]),
    ),
  );
  return nested.flat();
}

describe("skins/", () => {
  it("holds the four examples, one folder each", async () => {
    const entries = await readdir(SKINS, { withFileTypes: true });
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    expect([...folders].sort()).toEqual([...SLUGS].sort());
  });

  it.each(SLUGS)("%s holds skin.json and assets/preview.png, and no mascot clips", async (slug) => {
    const files = await filesUnder(join(SKINS, slug));
    expect([...files].sort()).toEqual([PREVIEW_PATH, "skin.json"]);
    expect(files.some((path) => path.startsWith(MASCOT_DIR))).toBe(false);
  });
});

describe("npm run validate over skins/*", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(SLUGS)("accepts %s", async (slug) => {
    const { io, log, error } = capture();
    expect(await runValidate([join(SKINS, slug)], io)).toBe(0);
    expect(error).toEqual([]);
    expect(log).toEqual([expect.stringContaining(`(${slug} 1.0.0) is a valid automatos-skin/v1 skin.`)]);
  });

  it.each(SLUGS)("packs %s into dist/", async (slug) => {
    const outDir = await mkdtemp(join(tmpdir(), "skin-examples-"));
    try {
      const { io, error } = capture();
      expect(await runPack([join(SKINS, slug)], io, { outDir })).toBe(0);
      expect(error).toEqual([]);
      expect((await stat(join(outDir, `${slug}-1.0.0.autoskin`))).size).toBeGreaterThan(0);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

describe("each example's colours", () => {
  it.each(SLUGS)("%s sets both sides of every contrast pair it touches, and each passes", async (slug) => {
    const skin = await validated(slug, { baseTokens });
    for (const tone of skin.tones) {
      const tokens = skin.tokens[tone] ?? {};
      for (const pair of CONTRAST_PAIRS) {
        const text = tokens[pair.text];
        const on = tokens[pair.on];
        const where = `${slug} ${tone} ${pair.text} on ${pair.on}`;
        const both = (text === undefined) === (on === undefined) || (text === undefined && UNPAIRED_IN_CORE.has(pair.text));
        expect({ where, both }).toEqual({ where, both: true });
        if (text && on) expect({ where, passes: tripletContrast(text, on) >= pair.min }).toEqual({ where, passes: true });
      }
    }
  });

  it("muted text also reads on cards (the core's pair list)", async () => {
    for (const slug of SLUGS) {
      const skin = await validated(slug);
      for (const tone of skin.tones) {
        const tokens = skin.tokens[tone] ?? {};
        const muted = tokens["muted-foreground"];
        const card = tokens.card;
        if (muted && card) expect(tripletContrast(muted, card)).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
      }
    }
  });
});

describe("what the PRD asks of each example", () => {
  it("Ember: warm graphite and molten, both tones, Auto", async () => {
    const skin = await validated("ember");
    expect(skin.tones).toEqual(["light", "dark"]);
    expect(skin.tokens.dark?.background).toBe(hexToTriplet(GROUNDS.graphite.bg));
    expect(skin.tokens.dark?.card).toBe(hexToTriplet(GROUNDS.graphite.surface));
    expect(skin.tokens.dark?.primary).toBe(hexToTriplet(ACCENTS.molten.hex));
    expect(skin.mascot).toEqual({ mode: "auto", shell: "bronze", light: hexToTriplet(LIGHTS.mint.hex) });
  });

  it("Daylight: paper and molten, light only, molten darkened wherever it is text", async () => {
    const skin = await validated("daylight");
    expect(skin.tones).toEqual(["light"]);
    expect(skin.tokens.dark).toBeUndefined();
    const light = skin.tokens.light ?? {};
    expect(light.background).toBe(hexToTriplet(GROUNDS.paper.bg));
    expect(light.primary).toBe(hexToTriplet(ACCENTS.molten.hex));
    // Raw molten fails as text on paper (2.49:1); the accent, ring and destructive are the readable variants.
    expect(tripletContrast(hexToTriplet(ACCENTS.molten.hex), light.background ?? "")).toBeLessThan(AA_TEXT_RATIO);
    for (const name of ["accent", "destructive"] as const) {
      expect(tripletContrast(light[name] ?? "", light.background ?? "")).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
      expect(tripletContrast(light[name] ?? "", light.card ?? "")).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
    }
  });

  it("Workshop: the original indigo night with molten, dark, Auto", async () => {
    const skin = await validated("workshop");
    expect(skin.tones).toEqual(["dark"]);
    expect(skin.tokens.dark?.background).toBe(hexToTriplet(GROUNDS.indigo.bg));
    expect(skin.tokens.dark?.primary).toBe(hexToTriplet(ACCENTS.molten.hex));
    expect(skin.mascot?.mode).toBe("auto");
  });

  it("Neon: dark only, void ground and arc cyan from the Command looks.json", async () => {
    const looks = JSON.parse(await readFile(join(REPO, "docs", "design", "command", "looks.json"), "utf8")) as {
      options: { accent: Record<string, { hex: string; ink: string }>; ground: Record<string, { bg: string }> };
      fixed: { text: string; text2: string };
    };
    const skin = await validated("neon");
    expect(skin.tones).toEqual(["dark"]);
    const dark = skin.tokens.dark ?? {};
    expect(dark.background).toBe(hexToTriplet(looks.options.ground.void?.bg ?? ""));
    expect(dark.primary).toBe(hexToTriplet(looks.options.accent.arc?.hex ?? ""));
    expect(dark["primary-foreground"]).toBe(hexToTriplet(looks.options.accent.arc?.ink ?? ""));
    expect(dark.foreground).toBe(hexToTriplet(looks.fixed.text));
    expect(dark["muted-foreground"]).toBe(hexToTriplet(looks.fixed.text2));
  });

  it("only Ember and Workshop bring Auto, and none brings its own clips", async () => {
    const modes = await Promise.all(SLUGS.map(async (slug) => [slug, (await validated(slug)).mascot?.mode] as const));
    expect(Object.fromEntries(modes)).toEqual({ ember: "auto", daylight: "off", workshop: "auto", neon: "off" });
  });

  it("keeps Auto's clips out of git", async () => {
    const ignored = (await readFile(join(REPO, ".gitignore"), "utf8")).split("\n").map((line) => line.trim());
    expect(ignored).toContain("public/auto/");
  });
});

describe("the preview pictures", () => {
  it.each(SLUGS)("%s has a 960 × 540 PNG within the size cap", async (slug) => {
    const bytes = new Uint8Array(await readFile(join(SKINS, slug, PREVIEW_PATH)));
    expect(sniffType(bytes)).toBe("png");
    expect(bytes.length).toBeLessThanOrEqual(PREVIEW_MAX_BYTES);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([960, 540]);
    expect((await skinJson(slug)).preview).toBe(PREVIEW_PATH);
  });
});

describe("EXAMPLE_SKINS", () => {
  it("lists the four, in order, each draft read from its skin.json", async () => {
    expect(EXAMPLE_SKINS.map((example) => [example.slug, example.name])).toEqual([
      ["ember", "Ember"],
      ["daylight", "Daylight"],
      ["workshop", "Workshop"],
      ["neon", "Neon"],
    ]);
    for (const slug of SLUGS) {
      expect(findExample(slug)?.draft).toEqual(draftFromSkin(await validated(slug)));
    }
  });

  it("finds examples by slug only, and builds their links", () => {
    expect(findExample("neon")?.name).toBe("Neon");
    expect(findExample("../neon")).toBeUndefined();
    expect(findExample("constructor")).toBeUndefined();
    expect(startFromHref("ember")).toBe("/?start=ember");
    expect(examplePreviewUrl("ember")).toBe("/examples/ember/preview.png");
  });
});
