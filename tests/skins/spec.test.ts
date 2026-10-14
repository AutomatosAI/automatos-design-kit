// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_TOKENS,
  BASES,
  CONTRAST_PAIRS,
  DERIVED_ALIASES,
  FONT_FILE_PATTERN,
  FONT_MAX_BYTES,
  GLOW_MAX,
  HEX_COLOUR_PATTERN,
  HSL_TRIPLET_PATTERN,
  MASCOT_FORMATS,
  MASCOT_MODES,
  MASCOT_SHELLS,
  MASCOT_STATES,
  MASCOT_MAX_BYTES,
  NAME_MAX,
  DESCRIPTION_MAX,
  PACKAGE_MAX_BYTES,
  PREVIEW_MAX_BYTES,
  PREVIEW_PATH,
  RADIUS_MAX,
  REQUIRED_FIELDS,
  SEMVER_PATTERN,
  SKIN_FIELDS,
  SKIN_SCHEMA,
  SLUG_PATTERN,
  STUDIO_FONTS,
  TONES,
} from "@/lib/skins/format";

// spec/automatos-skin.v1.schema.json and lib/skins/format.ts describe the same format. When
// sync-schema brings Studio's own schema in, a difference here means the validator is stale.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "spec", "automatos-skin.v1.schema.json"), "utf8"));
const PROPS = SCHEMA.properties;
const DEFS = SCHEMA.$defs;

describe("the spec/ schema", () => {
  it("says what it follows and that Studio hasn't published it yet", () => {
    expect(SCHEMA.title).toBe(SKIN_SCHEMA);
    expect(SCHEMA["x-status"]).toBe("draft-until-studio-publishes");
    expect(SCHEMA["x-follows"].prd).toContain("PRD-259");
    expect(SCHEMA["x-follows"].revision).toContain("14 Oct 2026");
    expect(SCHEMA["x-source"].kind).toBe("prd-draft");
  });

  it("has the validator's fields, required fields and no others", () => {
    expect(Object.keys(PROPS)).toEqual([...SKIN_FIELDS]);
    expect(SCHEMA.required).toEqual([...REQUIRED_FIELDS]);
    expect(SCHEMA.additionalProperties).toBe(false);
    expect(PROPS.schema.const).toBe(SKIN_SCHEMA);
    expect(PROPS.base.enum).toEqual([...BASES]);
    expect(PROPS.tones.items.enum).toEqual([...TONES]);
    expect(PROPS.preview.const).toBe(PREVIEW_PATH);
  });

  it("allows exactly the validator's token names and colour formats", () => {
    expect(DEFS.toneTokens.propertyNames.enum).toEqual([...ALLOWED_TOKENS]);
    expect(SCHEMA["x-derived-aliases"]).toEqual([...DERIVED_ALIASES]);
    expect(DEFS.colour.anyOf.map((option: { pattern: string }) => option.pattern)).toEqual([
      HSL_TRIPLET_PATTERN.source,
      HEX_COLOUR_PATTERN.source,
    ]);
  });

  it("uses the validator's patterns and ranges", () => {
    expect(PROPS.slug.pattern).toBe(SLUG_PATTERN.source);
    expect(PROPS.version.pattern).toBe(SEMVER_PATTERN.source);
    expect(PROPS.name.maxLength).toBe(NAME_MAX);
    expect(PROPS.description.maxLength).toBe(DESCRIPTION_MAX);
    expect(PROPS.shape.properties.radius.maximum).toBe(RADIUS_MAX);
    expect(PROPS.shape.properties.glow.maximum).toBe(GLOW_MAX);
    expect(DEFS.font.anyOf[0].enum).toEqual([...STUDIO_FONTS]);
    expect(DEFS.font.anyOf[1].pattern).toBe(FONT_FILE_PATTERN.source);
  });

  it("has the validator's mascot rules, contrast pairs and size caps", () => {
    expect(PROPS.mascot.properties.mode.enum).toEqual([...MASCOT_MODES]);
    expect(PROPS.mascot.properties.shell.enum).toEqual([...MASCOT_SHELLS]);
    expect(SCHEMA["x-mascot-states"]).toEqual([...MASCOT_STATES]);
    expect(SCHEMA["x-mascot-formats"]).toEqual([...MASCOT_FORMATS]);
    expect(SCHEMA["x-contrast"].pairs).toEqual(CONTRAST_PAIRS.map((pair) => ({ ...pair })));
    expect(SCHEMA["x-limits"]).toEqual({
      fontMaxBytes: FONT_MAX_BYTES,
      mascotMaxBytes: MASCOT_MAX_BYTES,
      previewMaxBytes: PREVIEW_MAX_BYTES,
      packageMaxBytes: PACKAGE_MAX_BYTES,
    });
  });

  it("its patterns accept and refuse what the validator does", () => {
    const triplet = new RegExp(DEFS.colour.anyOf[0].pattern);
    expect(["16 100% 50%", "0 0% 0%", "360 100% 100%", "359.99 99.5% 0.25%"].every((value) => triplet.test(value))).toBe(true);
    expect(["361 0% 0%", "16 100% 50", "16 100.001% 50%", "-1 0% 0%"].some((value) => triplet.test(value))).toBe(false);
  });
});
