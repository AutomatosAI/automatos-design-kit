import {
  FONT_FILE_PATTERN,
  FONT_SLOTS,
  GLOW_MAX,
  GLOW_MIN,
  MASCOT_LIGHTS,
  MASCOT_MODES,
  MASCOT_SHELLS,
  RADIUS_MAX,
  RADIUS_MIN,
  SHIPPED_FONTS,
  type FontSlot,
  type SkinError,
  type SkinFonts,
  type SkinMascot,
  type SkinShape,
} from "./format";
import {
  echo,
  fieldPath,
  isRecord,
  listWords,
  oneOf,
  pass,
  recordOf,
  unknownFieldErrors,
  type Checked,
} from "./validate-common";

// fonts, shape and mascot: the optional parts of skin.json. Whether the files they name are in
// the package is validate-files.ts's job.

function result<T>(value: T, errors: readonly SkinError[]): Checked<T> {
  return errors.length > 0 ? { value: null, errors } : pass(value);
}

function objectError(path: string, what: string): Checked<never> {
  return { value: null, errors: [{ path, message: `"${path.replace(/^\$\./, "")}" must be an object with ${what}.` }] };
}

function fontError(path: string, value: unknown): SkinError | null {
  if (oneOf(SHIPPED_FONTS, value)) return null;
  if (typeof value === "string" && FONT_FILE_PATTERN.test(value)) return null;
  const shown = typeof value === "string" ? echo(value) : "This";
  return {
    path,
    message: `${shown} isn't a font Studio ships (${listWords(SHIPPED_FONTS)}) or a woff2 file in assets/fonts/ named with letters, digits, - and _, such as "assets/fonts/my-face.woff2".`,
  };
}

export function checkFonts(value: unknown): Checked<SkinFonts | undefined> {
  if (value === undefined) return pass(undefined);
  if (!isRecord(value)) return objectError("$.fonts", `"sans", "serif" and/or "mono"`);
  const unknown = unknownFieldErrors(value, FONT_SLOTS, "$.fonts", "fonts (only sans, serif and mono)");
  const set = FONT_SLOTS.filter((slot) => value[slot] !== undefined);
  const errors = [...unknown, ...set.flatMap((slot) => fontError(fieldPath("$.fonts", slot), value[slot]) ?? [])];
  const fonts = recordOf(set.map((slot): readonly [FontSlot, string] => [slot, String(value[slot])]));
  return result(fonts, errors);
}

function wholeNumberError(path: string, value: unknown, min: number, max: number, unit: string): SkinError | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) return null;
  return { path, message: `"${path.replace(/^\$\./, "")}" must be a whole number from ${min} to ${max}${unit}.` };
}

export function checkShape(value: unknown): Checked<SkinShape | undefined> {
  if (value === undefined) return pass(undefined);
  if (!isRecord(value)) return objectError("$.shape", `"radius" and/or "glow"`);
  const errors = [
    ...unknownFieldErrors(value, ["radius", "glow"], "$.shape", "shape (only radius and glow)"),
    ...(value.radius === undefined ? [] : [wholeNumberError("$.shape.radius", value.radius, RADIUS_MIN, RADIUS_MAX, " px")]),
    ...(value.glow === undefined ? [] : [wholeNumberError("$.shape.glow", value.glow, GLOW_MIN, GLOW_MAX, "")]),
  ].flatMap((error) => (error ? [error] : []));
  const shape: SkinShape = {
    ...(typeof value.radius === "number" ? { radius: value.radius } : {}),
    ...(typeof value.glow === "number" ? { glow: value.glow } : {}),
  };
  return result(shape, errors);
}

function modeError(value: unknown): SkinError | null {
  if (oneOf(MASCOT_MODES, value)) return null;
  return { path: "$.mascot.mode", message: `"mascot.mode" must be ${listWords(MASCOT_MODES)}.` };
}

function shellError(value: unknown): SkinError | null {
  if (value === undefined || oneOf(MASCOT_SHELLS, value)) return null;
  return { path: "$.mascot.shell", message: `"mascot.shell" must be one of Auto's shell tints: ${listWords(MASCOT_SHELLS)}.` };
}

function lightError(value: unknown): SkinError | null {
  if (value === undefined || oneOf(MASCOT_LIGHTS, value)) return null;
  return { path: "$.mascot.light", message: `"mascot.light" must be one of Auto's light colours: ${listWords(MASCOT_LIGHTS)}.` };
}

export function checkMascot(value: unknown): Checked<SkinMascot | undefined> {
  if (value === undefined) return pass(undefined);
  if (!isRecord(value)) return objectError("$.mascot", `"mode" ("off", "auto" or "custom")`);
  const errors = [
    ...unknownFieldErrors(value, ["mode", "shell", "light"], "$.mascot", "mascot (only mode, shell and light)"),
    ...[modeError(value.mode), shellError(value.shell), lightError(value.light)].flatMap((error) => (error ? [error] : [])),
  ];
  if (errors.length > 0 || !oneOf(MASCOT_MODES, value.mode)) return { value: null, errors };
  return pass({
    mode: value.mode,
    ...(oneOf(MASCOT_SHELLS, value.shell) ? { shell: value.shell } : {}),
    ...(oneOf(MASCOT_LIGHTS, value.light) ? { light: value.light } : {}),
  });
}
