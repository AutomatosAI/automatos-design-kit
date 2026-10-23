/**
 * The codes the Marketplace review reports on a theme's source/, one ESLint rule each: every code of
 * @automatos/theme-rules' RULES table, then the codes its other checks report (CHECK_CODES). The plugin's
 * tests hold this list to every code literal in theme-rules' source, so a code added there without a rule
 * here fails CI.
 */
import { RULES, type Severity } from '@automatos/theme-rules'

/** An ESLint rule level: an error refuses the package, a warning is listed for the reviewer. */
export type Level = 'error' | 'warn'

/**
 * The codes js-rules.ts reports beside its table: its import checks (the `@/` alias, Next.js, and what
 * the vite-preset refuses), its path check, its import() check and its minified or obfuscated source
 * checks. Each is an error.
 */
export const CHECK_CODES: readonly string[] = Object.freeze([
  'JS_ALIAS_IMPORT',
  'JS_NEXT_IMPORT',
  'JS_IMPORT',
  'JS_PATH_IMPORT',
  'JS_DYNAMIC_IMPORT',
  'JS_MINIFIED',
  'JS_OBFUSCATED',
])

/** Every code once: the table's in its order, then the checks'. */
export const CODES: readonly string[] = Object.freeze(Array.from(new Set([
  ...RULES.map((row) => row.code),
  ...CHECK_CODES,
])))

/** A code is a warning when every table row with it is one; the checks' codes are errors. */
export function severityOf(code: string): Severity {
  const rows = RULES.filter((row) => row.code === code)
  return rows.length > 0 && rows.every((row) => row.severity === 'warning') ? 'warning' : 'error'
}

/** The ESLint level a code's rule runs at in the recommended config. */
export function levelOf(code: string): Level {
  return severityOf(code) === 'warning' ? 'warn' : 'error'
}
