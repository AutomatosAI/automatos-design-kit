/**
 * The recommended config's parser, which parses nothing. The rules read a file's text, as the Marketplace
 * review does, so ESLint needs only a Program that spans the text:
 *
 * - TypeScript and JSX lint with no parser package, and a syntax error is the typecheck's to report.
 * - The Program holds no comments, so ESLint reads no directive: an `eslint-disable` comment hides no
 *   finding (the review honours none), and one naming another plugin's rule (a file copied from an app)
 *   is not an error. The rules still read every comment's text, as the review does.
 */
import type { AST, Linter } from 'eslint'
import { PACKAGE } from './package-meta.ts'

/**
 * ESLint's own line breaks (SourceCode's lines), so the Program ends where ESLint's last line does. U+2028
 * and U+2029 are written as escapes: either one raw would end the regular expression literal.
 */
const LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/u

/** An empty Program spanning `text`: no statements, no tokens and no comments. */
export function parseText(text: string): AST.Program {
  const lines = text.split(LINE_BREAK)
  const last = lines[lines.length - 1]
  return {
    type: 'Program',
    sourceType: 'module',
    body: [],
    comments: [],
    tokens: [],
    range: [0, text.length],
    loc: { start: { line: 1, column: 0 }, end: { line: lines.length, column: last.length } },
  }
}

export const textParser: Linter.Parser = Object.freeze({
  meta: Object.freeze({ name: `${PACKAGE.name}/text-parser`, version: PACKAGE.version }),
  parse: parseText,
})
