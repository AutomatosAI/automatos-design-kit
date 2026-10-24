/**
 * The full template's de-branding (PRD-261 B-03f, QB-39): Play's names replaced by the new theme's, as
 * templates/full/template.json lists the rules, in one pass over each text and each path.
 *
 * A rule is a pattern and what it becomes, the theme's names filled in (`{{htmlClass}}`, `{{pascal}}` and the rest of
 * placeholders.ts `ThemeNames`). Every rule is tried at each place in the text, in the file's order, and the text a
 * rule writes is never read again: a theme whose name holds "play" (acme/replay) is not renamed twice. A `keep` phrase
 * is matched first and written back as it was, so Play's verbs ("Play the motion") stay verbs.
 *
 * Two guards keep the copy whole. A rule marked `identifier` names code: when it would turn one of Play's names into
 * another name Play already has, the two would merge, so `renameCollisions` names them and `new` refuses the theme.
 * And no two of Play's files may land on one path (`pathCollisions`).
 */
import { fillPlaceholders, type ThemeNames } from './placeholders.ts'

/** One rule as template.json writes it. */
export interface RenameRule {
  /** A JavaScript regular expression's source; no capture groups of its own. */
  readonly pattern: string
  /** What a match becomes, with the theme's names as placeholders. */
  readonly to: string
  /** True for a rule that writes code names (a component, a constant), which the collision guard reads. */
  readonly identifier?: boolean
}

export interface RenameSpec {
  /** Phrases written back as they are: Play's verbs. */
  readonly keep: readonly string[]
  readonly renames: readonly RenameRule[]
}

/** The rules made ready for a theme: one expression, and what each of its groups becomes. */
export interface Renamer {
  readonly text: (text: string) => string
  /** The same pass with the identifier rules alone. */
  readonly identifiers: (text: string) => string
}

const REGEXP_SYNTAX = /[\\^$.*+?()[\]{}|/]/g
/** A name as code writes one. */
const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g

/** The theme's names as the rules' placeholders. */
function ruleValues(names: ThemeNames): Readonly<Record<string, string>> {
  const { id, publisher, slug, name, htmlClass, pascal, constant, camel } = names
  return { id, publisher, slug, name, htmlClass, pascal, constant, camel }
}

/** `text` with every keep phrase and rule applied in one pass: each place matched once, by the first that fits. */
function onePass(keep: readonly string[], rules: readonly RenameRule[], values: Readonly<Record<string, string>>): (text: string) => string {
  const kept = keep.map((phrase) => phrase.replace(REGEXP_SYNTAX, String.raw`\$&`))
  const alternatives = [...kept, ...rules.map((rule) => rule.pattern)]
  if (alternatives.length === 0) return (text) => text
  const pattern = new RegExp(alternatives.map((source) => `(${source})`).join('|'), 'g')
  const written = [...keep, ...rules.map((rule) => fillPlaceholders(rule.to, values, `the rename of /${rule.pattern}/`))]
  return (text) => text.replace(pattern, (...match: unknown[]) => {
    const groups = match.slice(1, alternatives.length + 1)
    const index = groups.findIndex((group) => group !== undefined)
    return written[index]
  })
}

/** The template's rules made ready for the theme `names`. */
export function renamer(spec: RenameSpec, names: ThemeNames): Renamer {
  const values = ruleValues(names)
  return {
    text: onePass(spec.keep, spec.renames, values),
    identifiers: onePass(spec.keep, spec.renames.filter((rule) => rule.identifier === true), values),
  }
}

/** Every code name in `texts`. */
function identifiersOf(texts: Iterable<string>): Set<string> {
  const found = new Set<string>()
  for (const text of texts) for (const match of text.matchAll(IDENTIFIER)) found.add(match[0])
  return found
}

/**
 * Each of Play's code names an identifier rule would turn into another name Play already has, as `from → to`:
 * the copy would merge two of its names into one.
 */
export function renameCollisions(texts: Iterable<string>, rename: Renamer): string[] {
  const names = identifiersOf(texts)
  return Array.from(names).flatMap((name) => {
    const renamed = rename.identifiers(name)
    return renamed !== name && names.has(renamed) ? [`${name} → ${renamed}`] : []
  }).sort()
}

/** Each target path two or more of `paths` would land on, with the paths that would. */
export function pathCollisions(paths: Iterable<string>, rename: Renamer): string[] {
  const targets = new Map<string, string[]>()
  for (const path of paths) targets.set(rename.text(path), [...(targets.get(rename.text(path)) ?? []), path])
  return Array.from(targets).filter(([, from]) => from.length > 1).map(([to, from]) => `${from.join(', ')} → ${to}`).sort()
}
