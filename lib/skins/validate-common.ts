import type { SkinError } from "./format";

// Shared pieces of the skin validator. Errors are plain sentences a designer can act on, with
// the JSON path they belong to; they never echo long input back.

export type Fields = Readonly<Record<string, unknown>>;

/** `value` is null when the check failed, undefined when an optional field is absent. */
export interface Checked<T> {
  readonly value: T | null;
  readonly errors: readonly SkinError[];
}

const ECHO_MAX = 40;

export function pass<T>(value: T): Checked<T> {
  return { value, errors: [] };
}

export function fail(path: string, message: string): Checked<never> {
  return { value: null, errors: [{ path, message }] };
}

export function isRecord(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Control and format characters: C0, C1, bidi overrides, zero-width marks, line separators. */
const INVISIBLE = /\p{Cf}|[\u2028\u2029]/u;

export function isControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || INVISIBLE.test(char);
}

/** Quoted, cut to ECHO_MAX characters, control characters shown as "?". */
export function echo(text: string): string {
  const chars = [...text].map((char) => (isControl(char) ? "?" : char));
  const cut = chars.length > ECHO_MAX ? `${chars.slice(0, ECHO_MAX).join("")}…` : chars.join("");
  return `"${cut}"`;
}

export function fieldPath(parent: string, key: string): string {
  return `${parent}.${key}`;
}

export function unknownFieldErrors(input: Fields, known: readonly string[], path: string, what: string): SkinError[] {
  return Object.keys(input)
    .filter((key) => !known.includes(key))
    .map((key) => ({ path: fieldPath(path, key), message: `${echo(key)} isn't part of ${what}. Remove it.` }));
}

export function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function listWords(list: readonly string[]): string {
  return list.map((item) => `"${item}"`).join(", ");
}

/**
 * A skin is data: no links, no markup, no script schemes in its words. Studio refuses "<", ">",
 * "://", "url(" and "javascript:" (any case); the kit also refuses the rest of these, so a skin
 * it passes always passes Studio.
 */
const URL_LIKE = /:\/\/|(?:^|\s)\/\/\S|\bwww\.|url\(|javascript:|\b(?:vbscript|data|mailto|file):\S/i;
const MARKUP = /[<>]/;

interface TextRule {
  readonly max: number;
  readonly required: boolean;
}

/** `raw` is the text as written: Studio counts its length and looks for control characters untrimmed. */
function textProblem(raw: string, rule: TextRule): string | null {
  const length = [...raw].length;
  if (raw.trim() === "") return "can't be empty.";
  if (length > rule.max) return `must be at most ${rule.max} characters (it has ${length}).`;
  if ([...raw].some(isControl)) return "must be one line of plain text.";
  if (URL_LIKE.test(raw)) return "can't hold a link or web address: a skin is data only.";
  if (MARKUP.test(raw)) return "can't hold < or >: a skin never carries HTML or SVG.";
  return null;
}

export function checkText(path: string, value: unknown, rule: TextRule): Checked<string | undefined> {
  const field = path.replace(/^\$\./, "");
  if (value === undefined) return rule.required ? fail(path, `"${field}" is required.`) : pass(undefined);
  if (typeof value !== "string") return fail(path, `"${field}" must be text.`);
  const problem = textProblem(value, rule);
  return problem ? fail(path, `"${field}" ${problem}`) : pass(value.trim());
}

/** A typed record from entries (Object.fromEntries widens keys to string). */
export function recordOf<K extends string, V>(entries: readonly (readonly [K, V])[]): Partial<Record<K, V>> {
  const record: Partial<Record<K, V>> = {};
  for (const [key, value] of entries) record[key] = value;
  return record;
}

/** The value of a check that passed; only called once every check reported no error. */
export function settled<T>(checked: Checked<T>): T {
  if (checked.value === null) throw new Error("settled() read a failed check");
  return checked.value;
}
