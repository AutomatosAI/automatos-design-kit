// PRD-261 A-16c: scripts/compile-looks.mjs writes Play's look data from Play's own catalogue and presets.
// The schema is core's play-look-schema.json byte for byte, the five presets pass it, the prepaint table
// passes core's CSS-value check, and painting a look from the table (as core's boot script does) sets
// exactly the variables Play's engine gives that look. One case runs the real script with Node.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { prepaintErrors } from "../packages/theme-cli/src/core/css-value.ts";
import { validateLookSchema } from "../packages/theme-cli/src/core/look-schema.ts";
import { fileKind } from "../packages/theme-cli/src/files.ts";
import { lookFileErrors, presetIds } from "../packages/theme-cli/src/looks.ts";
import type { PrepaintNumericRule, PrepaintTable, PrepaintVars } from "../scripts/looks/boot-types.ts";
import { lookFiles, PREPAINT_FILE, SCHEMA_FILE } from "../scripts/looks/compile.ts";
import {
  ACCENT_KEYS, GROUND_KEYS, LIGHT_KEYS, SHELL_KEYS, TYPE_STYLE_KEYS,
} from "../themes/play/src/lib/looks/catalogue.ts";
import { GLOW_VAR, lookToCssVars, lookToStudioTokens, safeGlowAlpha } from "../themes/play/src/lib/looks/engine.ts";
import { DEFAULT_LOOK, PRESETS } from "../themes/play/src/lib/looks/presets.ts";
import { GLOW_MAX, GLOW_MIN, type Look } from "../themes/play/src/lib/looks/types.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/compile-looks.mjs", import.meta.url));
const PLAY = fileURLToPath(new URL("../themes/play/", import.meta.url));
/** core's orchestrator/services/themes/data/play-look-schema.json at ebedc7eb8d7f7f9d032706728a7f420a9e833392. */
const CORE_SCHEMA = fileURLToPath(new URL("./fixtures/core/play-look-schema.json", import.meta.url));
const PRESET_IDS = ["aurora", "daylight", "ember", "obsidian", "workshop"];
const KNOBS = ["ground", "accent", "font", "shell", "light", "glow"];
const CHOICES: Readonly<Record<string, readonly string[]>> = {
  ground: GROUND_KEYS, accent: ACCENT_KEYS, font: TYPE_STYLE_KEYS, shell: SHELL_KEYS, light: LIGHT_KEYS,
};
/** The boot script sets only names of this form (core's lib/theme-host/boot.ts, V). */
const BOOT_PROPERTY = /^--[a-z0-9-]{1,64}$/;

type LookFields = Readonly<Record<string, string | number>>;
const NO_VARS: PrepaintVars = {};

const files = lookFiles();
const text = (path: string): string => files.get(path) ?? "";
const table = JSON.parse(text(PREPAINT_FILE)) as PrepaintTable;
const fields = (look: Look): LookFields => look as unknown as LookFields;

/** The numeric rule's value: the colour at look[knob] / scale, never past the cap its table gives. */
function numericValue(rule: PrepaintNumericRule, look: LookFields): string {
  const alpha = Number(look[rule.knob]) / rule.scale;
  const capTable = rule.capTable;
  const cap = capTable && rule.caps ? rule.caps[String(look[capTable[0]])][String(look[capTable[1]])] : alpha;
  return `rgba(${rule.color.rgb[String(look[rule.color.knob])]},${Math.min(alpha, cap)})`;
}

/** The variables core's boot script paints for `look` from `prepaint`: knobs, then pairs, then numeric rules. */
function paint(prepaint: PrepaintTable, look: LookFields): Readonly<Record<string, string>> {
  const tables: (PrepaintVars | undefined)[] = [
    ...Object.entries(prepaint.knobs).map(([knob, options]) => options[String(look[knob])]),
    ...prepaint.pairs.map((pair) => pair.table[String(look[pair.a])]?.[String(look[pair.b])]),
  ];
  const fromTables = tables.flatMap((vars) => Object.entries(vars ?? NO_VARS)).filter(([name]) => BOOT_PROPERTY.test(name));
  const fromRules = prepaint.numeric.map((rule): [string, string] => [rule.var, numericValue(rule, look)]);
  return Object.fromEntries([...fromTables, ...fromRules]);
}

describe("compile-looks: the files", () => {
  it("are the schema, Play's five presets and the prepaint table", () => {
    const presets = PRESET_IDS.map((id) => `looks/presets/${id}.look.json`);
    expect(Array.from(files.keys())).toEqual([PREPAINT_FILE, ...presets, SCHEMA_FILE]);
    expect(Array.from(presetIds(files.keys())).sort()).toEqual(PRESET_IDS);
  });

  it("are each a file kind core accepts, within its cap", () => {
    files.forEach((body, path) => {
      const kind = fileKind(path);
      expect({ path, kind: kind?.name }).toEqual({ path, kind: expect.any(String) });
      expect(Buffer.byteLength(body)).toBeLessThanOrEqual(kind?.cap ?? 0);
    });
  });

  it("pass core's look checks: the schema, each preset against it, ids as file names", () => {
    const bytes = new Map(Array.from(files, ([path, body]): [string, Uint8Array] => [path, new TextEncoder().encode(body)]));
    expect(lookFileErrors(bytes)).toEqual([]);
  });

  it("hold theme.json's default look", () => {
    const manifest = JSON.parse(readFileSync(join(PLAY, "theme.json"), "utf8")) as { look?: string };
    expect(manifest.look).toBe(DEFAULT_LOOK.id);
    expect(presetIds(files.keys()).has(String(manifest.look))).toBe(true);
  });
});

describe("compile-looks: looks/schema.json", () => {
  const schema = JSON.parse(text(SCHEMA_FILE)) as { knobs: Record<string, Record<string, unknown>> };

  it("is core's play-look-schema.json byte for byte", () => {
    expect(text(SCHEMA_FILE)).toBe(readFileSync(CORE_SCHEMA, "utf8"));
    expect(validateLookSchema(schema).errors).toEqual([]);
  });

  it("has Play's knobs: the catalogue's keys as choices, the glow as a whole number, the default look's values", () => {
    expect(Object.keys(schema.knobs)).toEqual(KNOBS);
    Object.entries(CHOICES).forEach(([knob, choices]) => {
      expect(schema.knobs[knob]).toEqual({ kind: "choice", choices: [...choices], default: fields(DEFAULT_LOOK)[knob] });
    });
    expect(schema.knobs.glow).toEqual({ kind: "number", min: GLOW_MIN, max: GLOW_MAX, integer: true, default: DEFAULT_LOOK.glow });
  });
});

describe("compile-looks: the presets", () => {
  it.each(PRESETS.map((look): [string, Look] => [look.id, look]))("%s is the preset as presets.ts has it", (id, look) => {
    expect(JSON.parse(text(`looks/presets/${id}.look.json`))).toEqual(look);
  });
});

describe("compile-looks: boot/prepaint.json", () => {
  it("passes core's CSS-value check", () => {
    expect(prepaintErrors(table)).toEqual([]);
  });

  it("has a table per knob, the accent-on-ground pairs and the default look", () => {
    Object.entries(CHOICES).forEach(([knob, choices]) => expect(Object.keys(table.knobs[knob])).toEqual([...choices]));
    expect(Object.keys(table.knobs)).toEqual(KNOBS.filter((knob) => knob !== "glow"));
    expect(table.pairs.map((pair) => [pair.a, pair.b])).toEqual([["ground", "accent"]]);
    const defaults = Object.fromEntries(KNOBS.map((knob) => [knob, fields(DEFAULT_LOOK)[knob]]));
    expect(table.defaults).toEqual(defaults);
  });

  it("paints the glow as a numeric-knob rule, capped at each ground and accent's safe glow", () => {
    expect(table.numeric).toHaveLength(1);
    const [rule] = table.numeric;
    expect(rule).toMatchObject({
      var: GLOW_VAR, knob: "glow", min: GLOW_MIN, max: GLOW_MAX, integer: true, scale: 100,
      capTable: ["ground", "accent"], template: "rgba-alpha",
    });
    expect(rule.color.knob).toBe("accent");
    expect(Object.keys(rule.color.rgb)).toEqual([...ACCENT_KEYS]);
    GROUND_KEYS.forEach((ground) => ACCENT_KEYS.forEach((accent) => {
      expect(rule.caps?.[ground]?.[accent]).toBe(safeGlowAlpha(ground, accent));
    }));
  });

  it("paints every preset, and looks past the glow caps, as Play's engine does", () => {
    const looks: Look[] = [
      ...PRESETS,
      { ...DEFAULT_LOOK, id: "mine-1", glow: GLOW_MAX },
      { ...DEFAULT_LOOK, id: "mine-2", ground: "paper", accent: "cream", glow: 0 },
      { ...DEFAULT_LOOK, id: "mine-3", ground: "indigo", accent: "rose", font: "bric", shell: "silver", light: "ice", glow: GLOW_MAX },
    ];
    looks.forEach((look) => {
      const expected = { ...lookToCssVars(look), ...lookToStudioTokens(look) };
      expect({ id: look.id, vars: paint(table, fields(look)) }).toEqual({ id: look.id, vars: expected });
    });
  });
});

describe("scripts/compile-looks.mjs", () => {
  const dir = mkdtempSync(join(tmpdir(), "compile-looks-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("runs with Node alone and writes the same files, dropping a stale preset", () => {
    const stale = join(dir, "looks/presets/gone.look.json");
    mkdirSync(join(dir, "looks/presets"), { recursive: true });
    writeFileSync(stale, "{}\n");
    const run = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
    expect({ status: run.status, stderr: run.stderr.split("\n").filter((line) => line.startsWith("compile-looks")) })
      .toEqual({ status: 0, stderr: [] });
    expect(existsSync(stale)).toBe(false);
    files.forEach((body, path) => expect({ path, body: readFileSync(join(dir, path), "utf8") }).toEqual({ path, body }));
  });

  it("refuses more than one argument", () => {
    const run = spawnSync(process.execPath, [SCRIPT, dir, dir], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("usage: node scripts/compile-looks.mjs [themeDir]");
  });
});
