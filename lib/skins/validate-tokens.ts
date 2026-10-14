import { formatRatio, normaliseColour, tripletContrast } from "./colour";
import {
  ALLOWED_TOKENS,
  CONTRAST_PAIRS,
  DERIVED_ALIASES,
  TONES,
  type ContrastPair,
  type SkinBase,
  type SkinError,
  type Tone,
  type TokenName,
  type TokenValues,
  type ValidateOptions,
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
// and the AA pairs of PRD-259 §3 for each tone the skin declares.

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

function resolve(name: TokenName, own: TokenValues, fallback: TokenValues): string | null {
  return own[name] ?? normaliseColour(fallback[name]);
}

function pairError(tone: Tone, pair: ContrastPair, ratio: number): SkinError {
  const need = pair.text === "ring" ? `the focus ring needs at least ${pair.min}:1` : `text needs at least ${pair.min}:1`;
  return {
    path: `$.tokens.${tone}.${pair.text}`,
    message: `In ${tone}, ${pair.text} on ${pair.on} is ${formatRatio(ratio)}; ${need}.`,
  };
}

/**
 * Every pair the skin sets at least one side of, in this tone. The other side comes from the
 * skin's base when `baseTokens` is given; a pair with a side that can't be resolved is skipped.
 */
export function contrastErrors(tone: Tone, own: TokenValues, base: SkinBase, options: ValidateOptions): SkinError[] {
  const fallback = options.baseTokens?.(base, tone) ?? NO_TOKENS;
  return CONTRAST_PAIRS.flatMap((pair) => {
    if (own[pair.text] === undefined && own[pair.on] === undefined) return [];
    const text = resolve(pair.text, own, fallback);
    const on = resolve(pair.on, own, fallback);
    if (text === null || on === null) return [];
    const ratio = tripletContrast(text, on);
    return ratio < pair.min ? [pairError(tone, pair, ratio)] : [];
  });
}

function toneGapErrors(input: Fields, tones: readonly Tone[] | null): SkinError[] {
  if (tones === null) return [];
  return TONES.filter((tone) => input[tone] !== undefined && !tones.includes(tone)).map((tone) => ({
    path: `$.tokens.${tone}`,
    message: `This skin has no ${tone} tone ("tones" leaves it out), so remove tokens.${tone}.`,
  }));
}

/** `tones` and `base` are null when their own checks failed; contrast then waits for them. */
export function checkTokens(
  value: unknown,
  tones: readonly Tone[] | null,
  base: SkinBase | null,
  options: ValidateOptions,
): Checked<SkinTokens> {
  if (value === undefined) return fail("$.tokens", `"tokens" is required (use {} to keep the base's colours).`);
  if (!isRecord(value)) return fail("$.tokens", `"tokens" must be an object with "light" and/or "dark".`);
  const shape = [...unknownFieldErrors(value, TONES, "$.tokens", "tokens (only light and dark)"), ...toneGapErrors(value, tones)];
  const checked = TONES.filter((tone) => value[tone] !== undefined).map((tone) => ({
    tone,
    result: checkTone(`$.tokens.${tone}`, value[tone]),
  }));
  const formatErrors = checked.flatMap(({ result }) => result.errors);
  const errors = [...shape, ...formatErrors];
  if (errors.length > 0 || tones === null || base === null) return { value: null, errors };
  const tokens: SkinTokens = recordOf(checked.map(({ tone, result }) => [tone, result.value ?? NO_TOKENS] as const));
  const contrast = tones.flatMap((tone) => contrastErrors(tone, tokens[tone] ?? NO_TOKENS, base, options));
  return contrast.length > 0 ? { value: null, errors: contrast } : pass(tokens);
}
