import {
  AUTHOR_MAX,
  BASES,
  DESCRIPTION_MAX,
  LICENCE_MAX,
  NAME_MAX,
  PREVIEW_PATH,
  SEMVER_PATTERN,
  SKIN_SCHEMA,
  SLUG_MAX,
  SLUG_PATTERN,
  TONES,
  VERSION_MAX,
  type SkinBase,
  type Tone,
} from "./format";
import { checkText, fail, listWords, oneOf, pass, type Checked, type Fields } from "./validate-common";

// The header of skin.json: who made it, what it is, which base and tones it covers.

export interface SkinMeta {
  readonly schema: typeof SKIN_SCHEMA;
  readonly slug: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description: string | undefined;
  readonly licence: string | undefined;
  readonly base: SkinBase;
  readonly tones: readonly Tone[];
  readonly preview: typeof PREVIEW_PATH | undefined;
}

export type MetaChecks = { readonly [K in keyof SkinMeta]: Checked<SkinMeta[K]> };

function checkSchema(value: unknown): Checked<typeof SKIN_SCHEMA> {
  if (value === SKIN_SCHEMA) return pass(SKIN_SCHEMA);
  return fail("$.schema", `This isn't an ${SKIN_SCHEMA} skin: "schema" must be "${SKIN_SCHEMA}".`);
}

function checkSlug(value: unknown): Checked<string> {
  if (value === undefined) return fail("$.slug", `"slug" is required.`);
  if (typeof value === "string" && value.length <= SLUG_MAX && SLUG_PATTERN.test(value)) return pass(value);
  return fail(
    "$.slug",
    `"slug" must be lowercase letters and digits joined by single dashes, such as "night-shift", at most ${SLUG_MAX} characters.`,
  );
}

function checkVersion(value: unknown): Checked<string> {
  if (value === undefined) return fail("$.version", `"version" is required.`);
  if (typeof value === "string" && value.length <= VERSION_MAX && SEMVER_PATTERN.test(value)) return pass(value);
  return fail("$.version", `"version" must be a semantic version such as "1.0.0".`);
}

function checkBase(value: unknown): Checked<SkinBase> {
  if (oneOf(BASES, value)) return pass(value);
  return fail("$.base", `"base" must be ${listWords(BASES)}: the Studio style the skin builds on.`);
}

function checkTones(value: unknown): Checked<readonly Tone[]> {
  const message = `"tones" must be ["light", "dark"], ["light"] or ["dark"].`;
  if (!Array.isArray(value) || value.length < 1 || value.length > TONES.length) return fail("$.tones", message);
  if (!value.every((tone) => oneOf(TONES, tone))) return fail("$.tones", message);
  const tones: readonly Tone[] = value;
  if (new Set(tones).size !== tones.length) return fail("$.tones", `"tones" names a tone twice. ${message}`);
  return pass(TONES.filter((tone) => tones.includes(tone)));
}

function checkPreview(value: unknown): Checked<typeof PREVIEW_PATH | undefined> {
  if (value === undefined) return pass(undefined);
  if (value === PREVIEW_PATH) return pass(PREVIEW_PATH);
  return fail("$.preview", `"preview" must be "${PREVIEW_PATH}" (a PNG in the package).`);
}

function required(value: Checked<string | undefined>): Checked<string> {
  return value.value === undefined ? { value: null, errors: value.errors } : { value: value.value, errors: value.errors };
}

export function checkMeta(input: Fields): MetaChecks {
  const line = { required: true };
  return {
    schema: checkSchema(input.schema),
    slug: checkSlug(input.slug),
    name: required(checkText("$.name", input.name, { ...line, max: NAME_MAX })),
    version: checkVersion(input.version),
    author: required(checkText("$.author", input.author, { ...line, max: AUTHOR_MAX })),
    description: checkText("$.description", input.description, { required: false, max: DESCRIPTION_MAX }),
    licence: checkText("$.licence", input.licence, { required: false, max: LICENCE_MAX }),
    base: checkBase(input.base),
    tones: checkTones(input.tones),
    preview: checkPreview(input.preview),
  };
}
