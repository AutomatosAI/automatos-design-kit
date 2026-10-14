import { formatRatio, normaliseColour, tripletContrast } from "./colour";
import {
  ALLOWED_TOKENS,
  CONTRAST_PAIRS,
  DERIVED_ALIASES,
  TONES,
  type ContrastPair,
  type SkinError,
  type Tone,
  type TokenName,
  type TokenValues,
} from "./format";
import {
  echo,
  fail,
  fieldPath,
  isRecord,
  oneOf,
  pass,
  recordOf,
  unknownFieldErrors,
  type Checked,
  type Fields,
} from "./validate-common";

// tokens.light and tokens.dark: allowed names, colour formats (hex normalised to HSL triplets),
// one set per declared tone, and the AA pairs of PRD-259 §3 on the skin's own values (decision K5).

export type SkinTokens = Readonly<Partial<Record<Tone, TokenValues>>>;

const NO_TOKENS: TokenValues = {};

function tokenNameError(path: string, name: string): SkinError {
  const derived: readonly string[] = DERIVED_ALIASES;
  const message = derived.includes(name)
    ? `${echo(name)} is worked out by Studio from the core tokens; a skin can't set it. Remove it.`
    : `${echo(name)} isn't a token Studio lets a skin set. Remove it, or use one of the allowed names.`;
  return { path, message };
}

function colourError(path: string, value: unknown): SkinError {
  const shown = typeof value === "string" ? `${echo(value)} isn't a colour` : "This must be a colour";
  return { path, message: `${shown}. Use an HSL triplet such as "16 100% 50%" or #rrggbb.` };
}

type TokenEntry = { readonly ok: true; readonly name: TokenName; readonly colour: string } | { readonly ok: false; readonly error: SkinError };

function checkEntry(path: string, name: string, raw: unknown): TokenEntry {
  const at = fieldPath(path, name);
  if (!oneOf(ALLOWED_TOKENS, name)) return { ok: false, error: tokenNameError(at, name) };
  const colour = normaliseColour(raw);
  return colour === null ? { ok: false, error: colourError(at, raw) } : { ok: true, name, colour };
}

function checkTone(path: string, value: unknown): Checked<TokenValues> {
  if (!isRecord(value)) return fail(path, `This must be an object of token names and colours.`);
  const entries = Object.entries(value).map(([name, raw]) => checkEntry(path, name, raw));
  const errors = entries.flatMap((entry) => (entry.ok ? [] : [entry.error]));
  if (errors.length > 0) return { value: null, errors };
  return pass(recordOf(entries.flatMap((entry) => (entry.ok ? [[entry.name, entry.colour] as const] : []))));
}

function pairError(tone: Tone, pair: ContrastPair, ratio: number): SkinError {
  const need = pair.text === "ring" ? `the focus ring needs at least ${pair.min}:1` : `text needs at least ${pair.min}:1`;
  return {
    path: `$.tokens.${tone}.${pair.text}`,
    message: `In ${tone}, ${pair.text} on ${pair.on} is ${formatRatio(ratio)}; ${need}.`,
  };
}

function incompleteError(tone: Tone, given: TokenName, missing: TokenName): SkinError {
  return {
    path: `$.tokens.${tone}.${missing}`,
    message: `In ${tone}, setting ${given} needs ${missing} too: they are checked as a pair, on the skin's own colours.`,
  };
}

/**
 * Every pair the skin sets a side of, in this tone, on the skin's own values only (decision K5):
 * one side without the other is an error, and both sides must reach the pair's floor. A pair the
 * skin leaves to its base isn't checked, since Studio's own palettes fail some (Classic's primary).
 */
export function contrastErrors(tone: Tone, own: TokenValues): SkinError[] {
  return CONTRAST_PAIRS.flatMap((pair) => {
    const text = own[pair.text];
    const on = own[pair.on];
    if (text === undefined && on === undefined) return [];
    if (text === undefined) return [incompleteError(tone, pair.on, pair.text)];
    if (on === undefined) return [incompleteError(tone, pair.text, pair.on)];
    const ratio = tripletContrast(text, on);
    return ratio < pair.min ? [pairError(tone, pair, ratio)] : [];
  });
}

/** tokens.<tone> is there exactly when "tones" names the tone. */
function toneSetErrors(input: Fields, tones: readonly Tone[] | null): SkinError[] {
  if (tones === null) return [];
  return TONES.flatMap((tone): SkinError[] => {
    const present = input[tone] !== undefined;
    if (present === tones.includes(tone)) return [];
    const message = present
      ? `This skin has no ${tone} tone ("tones" leaves it out), so remove tokens.${tone}.`
      : `"tones" includes ${tone}, so tokens.${tone} is required (use {} to keep the base's colours).`;
    return [{ path: `$.tokens.${tone}`, message }];
  });
}

/** `tones` is null when its own check failed; contrast then waits for it. */
export function checkTokens(value: unknown, tones: readonly Tone[] | null): Checked<SkinTokens> {
  if (value === undefined) return fail("$.tokens", `"tokens" is required (use {} for a tone to keep the base's colours).`);
  if (!isRecord(value)) return fail("$.tokens", `"tokens" must be an object with "light" and/or "dark".`);
  const shape = [...unknownFieldErrors(value, TONES, "$.tokens", "tokens (only light and dark)"), ...toneSetErrors(value, tones)];
  const checked = TONES.filter((tone) => value[tone] !== undefined).map((tone) => ({
    tone,
    result: checkTone(`$.tokens.${tone}`, value[tone]),
  }));
  const formatErrors = checked.flatMap(({ result }) => result.errors);
  const errors = [...shape, ...formatErrors];
  if (errors.length > 0 || tones === null) return { value: null, errors };
  const tokens: SkinTokens = recordOf(checked.map(({ tone, result }) => [tone, result.value ?? NO_TOKENS] as const));
  const contrast = tones.flatMap((tone) => contrastErrors(tone, tokens[tone] ?? NO_TOKENS));
  return contrast.length > 0 ? { value: null, errors: contrast } : pass(tokens);
}
