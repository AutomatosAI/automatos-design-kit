import { FONTS_DIR, MASCOT_DIR, SKIN_FIELDS, type AssetEntry, type Skin, type SkinError, type SkinValidation, type ValidateOptions } from "./format";
import { isRecord, settled, unknownFieldErrors } from "./validate-common";
import { fileErrors } from "./validate-files";
import { checkMeta, type MetaChecks } from "./validate-meta";
import { checkFonts, checkMascot, checkShape } from "./validate-parts";
import { checkTokens } from "./validate-tokens";

// The one gate for a skin: skin.json (already parsed) plus the manifest of the package's other
// files. Pure: the CLI and, later, the editor and pack read the files and sniff their types.
// The same rules as Studio's (core PRD-259 §3); see spec/automatos-skin.v1.schema.json.

function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function metaErrors(meta: MetaChecks): readonly SkinError[] {
  const fields = Object.keys(meta) as (keyof MetaChecks)[];
  return fields.flatMap((field) => meta[field].errors);
}

function buildSkin(meta: MetaChecks, rest: Pick<Skin, "tokens" | "fonts" | "shape" | "mascot">): Skin {
  const description = settled(meta.description);
  const licence = settled(meta.licence);
  const preview = settled(meta.preview);
  return {
    schema: settled(meta.schema),
    slug: settled(meta.slug),
    name: settled(meta.name),
    version: settled(meta.version),
    author: settled(meta.author),
    ...optional("description", description),
    ...optional("licence", licence),
    base: settled(meta.base),
    tones: settled(meta.tones),
    tokens: rest.tokens,
    ...optional("fonts", rest.fonts),
    ...optional("shape", rest.shape),
    ...optional("mascot", rest.mascot),
    ...optional("preview", preview),
  };
}

export function validateSkin(input: unknown, assets: readonly AssetEntry[], options: ValidateOptions = {}): SkinValidation {
  if (!isRecord(input)) return { ok: false, errors: [{ path: "$", message: "skin.json must hold one JSON object." }] };
  const meta = checkMeta(input);
  const tokens = checkTokens(input.tokens, meta.tones.value);
  const fonts = checkFonts(input.fonts);
  const shape = checkShape(input.shape);
  const mascot = checkMascot(input.mascot);
  const named = {
    fonts: fonts.value ?? undefined,
    mascot: mascot.value ?? undefined,
    preview: meta.preview.value ?? undefined,
    unchecked: [...(fonts.value === null ? [FONTS_DIR] : []), ...(mascot.value === null ? [MASCOT_DIR] : [])],
  };
  const errors = [
    ...unknownFieldErrors(input, SKIN_FIELDS, "$", "an automatos-skin/v1 skin"),
    ...metaErrors(meta),
    ...tokens.errors,
    ...fonts.errors,
    ...shape.errors,
    ...mascot.errors,
    ...fileErrors(assets, named, options.packageBytes),
  ];
  if (errors.length > 0) return { ok: false, errors };
  const skin = buildSkin(meta, {
    tokens: settled(tokens),
    fonts: settled(fonts),
    shape: settled(shape),
    mascot: settled(mascot),
  });
  return { ok: true, skin, errors: [] };
}
