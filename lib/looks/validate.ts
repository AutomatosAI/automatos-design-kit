import { ACCENTS, GROUNDS, LIGHTS, SHELLS, TYPE_STYLES, isKeyOf } from "./catalogue";
import {
  GLOW_MAX,
  GLOW_MIN,
  LOOK_FIELDS,
  LOOK_ID_PATTERN,
  LOOK_INTERFACE,
  LOOK_SCHEMA,
  LOOK_TEXT_MAX,
  type Look,
  type ValidationResult,
} from "./types";

// The one gate for a Look from anywhere outside the code: storage, an imported file, pasted JSON.
// Pure. Errors are plain sentences a designer can act on; they never echo long input back.

const ECHO_MAX = 40;

type Fields = Readonly<Record<string, unknown>>;
type Checked<T> = { readonly value: T; readonly error: null } | { readonly value: null; readonly error: string };

function pass<T>(value: T): Checked<T> {
  return { value, error: null };
}

function fail(error: string): { readonly value: null; readonly error: string } {
  return { value: null, error };
}

function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function echo(text: string): string {
  const chars = [...text];
  return chars.length > ECHO_MAX ? `${chars.slice(0, ECHO_MAX).join("")}…` : text;
}

// C0 and C1 control characters (newlines, tabs, NUL...) don't belong in a one-line name.
function hasControl(text: string): boolean {
  return [...text].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || (code >= 0x7f && code <= 0x9f);
  });
}

function unknownFieldErrors(input: Fields): string[] {
  const known: readonly string[] = LOOK_FIELDS;
  return Object.keys(input)
    .filter((key) => !known.includes(key))
    .map((key) => `"${echo(key)}" isn't part of a Look. Remove it.`);
}

function headerErrors(input: Fields): string[] {
  const errors: string[] = [];
  if (input.schema !== LOOK_SCHEMA) errors.push(`This isn't a v1 Look: "schema" must be "${LOOK_SCHEMA}".`);
  if (input.interface !== LOOK_INTERFACE) errors.push(`This Look is for another interface: "interface" must be "${LOOK_INTERFACE}".`);
  return errors;
}

function checkId(value: unknown): Checked<string> {
  if (typeof value === "string" && LOOK_ID_PATTERN.test(value)) return pass(value);
  return fail(`"id" must be 1 to 64 letters, digits, dashes or underscores, starting with a letter or digit.`);
}

function checkText(field: "name" | "sub", value: unknown): Checked<string> {
  if (typeof value !== "string") return fail(`"${field}" must be text.`);
  const trimmed = value.trim();
  if (field === "name" && trimmed.length === 0) return fail(`"name" can't be empty.`);
  if ([...trimmed].length > LOOK_TEXT_MAX) return fail(`"${field}" must be at most ${LOOK_TEXT_MAX} characters.`);
  if (hasControl(trimmed)) return fail(`"${field}" must be one line of plain text.`);
  return pass(trimmed);
}

function checkKey<T extends object>(field: string, label: string, entries: T, value: unknown): Checked<keyof T & string> {
  if (isKeyOf(entries, value)) return pass(value);
  return fail(`"${field}" must be one of the catalogue's ${label}: ${Object.keys(entries).join(", ")}.`);
}

function checkGlow(value: unknown): Checked<number> {
  if (typeof value === "number" && Number.isInteger(value) && value >= GLOW_MIN && value <= GLOW_MAX) return pass(value);
  return fail(`"glow" must be a whole number from ${GLOW_MIN} to ${GLOW_MAX}.`);
}

function checkFields(input: Fields) {
  return {
    id: checkId(input.id),
    name: checkText("name", input.name),
    sub: checkText("sub", input.sub),
    ground: checkKey("ground", "backgrounds", GROUNDS, input.ground),
    accent: checkKey("accent", "accents", ACCENTS, input.accent),
    font: checkKey("font", "type styles", TYPE_STYLES, input.font),
    shell: checkKey("shell", "shells", SHELLS, input.shell),
    light: checkKey("light", "lights", LIGHTS, input.light),
    glow: checkGlow(input.glow),
  };
}

/** A fresh Look with only the known fields, or null when any field failed. */
function toLook(checked: ReturnType<typeof checkFields>): Look | null {
  const { id, name, sub, ground, accent, font, shell, light, glow } = checked;
  if (id.value === null || name.value === null || sub.value === null || glow.value === null) return null;
  if (ground.value === null || accent.value === null || font.value === null) return null;
  if (shell.value === null || light.value === null) return null;
  return {
    schema: LOOK_SCHEMA,
    id: id.value,
    name: name.value,
    sub: sub.value,
    interface: LOOK_INTERFACE,
    ground: ground.value,
    accent: accent.value,
    font: font.value,
    shell: shell.value,
    light: light.value,
    glow: glow.value,
  };
}

export function validateLook(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, errors: ["A Look must be a JSON object."] };
  const checked = checkFields(input);
  const fieldErrors = Object.values(checked).flatMap((result) => (result.error === null ? [] : [result.error]));
  const errors = [...unknownFieldErrors(input), ...headerErrors(input), ...fieldErrors];
  const look = toLook(checked);
  return errors.length === 0 && look !== null ? { ok: true, look } : { ok: false, errors };
}
