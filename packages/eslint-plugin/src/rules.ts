/**
 * One ESLint rule per review code. Each runs @automatos/theme-rules' own fileFindings on the file's text,
 * at the path the review reads it at (`source/` and the file's path under the theme's `src/`, which a
 * package carries as source/), and reports that code's findings on their lines with the review's message.
 *
 * The theme's src/ is `<cwd>/src` (eslint run from the theme's folder, as a theme's `lint` script runs
 * it), or `settings.automatos.sourceRoot`. A file outside it is not theme source: the rule stops with an
 * error naming both paths rather than check it at a path the review would never read.
 */
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { AST, Rule, SourceCode } from 'eslint'
import { fileFindings, SOURCE_PREFIX, type JsFinding } from '@automatos/theme-rules'

/** The theme folder's source tree, which its package carries as source/ (theme-cli's SOURCE_DIR). */
export const THEME_SOURCE_DIR = 'src'
/** The settings key: `settings: { automatos: { sourceRoot: '<the theme's src/ folder>' } }`. */
export const SETTINGS_KEY = 'automatos'
/** Every report's message id; its text is the finding's own message. */
export const MESSAGE_ID = 'finding'

interface Found {
  readonly path: string
  readonly findings: readonly JsFinding[]
}

/** One fileFindings run per file, shared by every rule linting it. */
const found = new WeakMap<SourceCode, Found>()

function sourceRootOf(context: Rule.RuleContext): string {
  const settings = context.settings[SETTINGS_KEY]
  const configured = typeof settings === 'object' && settings !== null
    ? (settings as Readonly<Record<string, unknown>>).sourceRoot
    : undefined
  if (configured === undefined) return resolve(context.cwd, THEME_SOURCE_DIR)
  if (typeof configured !== 'string' || configured === '') {
    throw new TypeError(`settings.${SETTINGS_KEY}.sourceRoot must be the theme's ${THEME_SOURCE_DIR}/ folder; got ${String(configured)}.`)
  }
  return resolve(context.cwd, configured)
}

/** The path the review reads the linted file at: source/ and its path under the theme's src/. */
export function sourcePathOf(context: Rule.RuleContext): string {
  const root = sourceRootOf(context)
  const file = resolve(context.cwd, context.physicalFilename)
  const path = relative(root, file)
  if (path === '' || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(
      `${file} is outside the theme's ${THEME_SOURCE_DIR}/ (${root}): the Marketplace review's rules read a theme's `
      + `${THEME_SOURCE_DIR}/ only. Run eslint from the theme's folder, or set settings.${SETTINGS_KEY}.sourceRoot.`,
    )
  }
  return `${SOURCE_PREFIX}${path.split(sep).join('/')}`
}

function findingsOf(context: Rule.RuleContext): readonly JsFinding[] {
  const path = sourcePathOf(context)
  const cached = found.get(context.sourceCode)
  if (cached !== undefined && cached.path === path) return cached.findings
  const findings = Object.freeze(fileFindings(path, context.sourceCode.text))
  found.set(context.sourceCode, { path, findings })
  return findings
}

/** A finding's whole line, as ESLint locates it (the review counts lines by \n alone). */
function lineLoc(sourceCode: SourceCode, line: number): AST.SourceLocation {
  const lines = sourceCode.text.split('\n')
  const index = Math.min(Math.max(line, 1), lines.length) - 1
  const start = lines.slice(0, index).reduce((offset, item) => offset + item.length + 1, 0)
  const end = start + lines[index].replace(/\r$/, '').length
  return { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) }
}

/** The rule for one review code: it reports every finding of that code in the file. */
export function codeRule(code: string): Rule.RuleModule {
  const rule: Rule.RuleModule = {
    meta: {
      type: 'problem',
      docs: { description: `Reports what the Marketplace review reports as ${code} (@automatos/theme-rules).` },
      messages: { [MESSAGE_ID]: '{{ message }}' },
      schema: [],
    },
    create(context) {
      return {
        Program() {
          findingsOf(context).filter((item) => item.code === code).forEach((item) => {
            context.report({
              messageId: MESSAGE_ID,
              data: { message: item.message },
              loc: lineLoc(context.sourceCode, item.line),
            })
          })
        },
      }
    },
  }
  return Object.freeze(rule)
}
