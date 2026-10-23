/**
 * The host's fonts as app/fonts/core/README.md pins them: its Faces table (each font file's variable, weight, style
 * and licence, as core declares them) and its Files table (each file's sha256 at the core commit it names).
 * test/host-fonts.test.ts holds the folder to it, and test/harness-build.test.ts the built page.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// From the string import.meta.url: under jsdom, `new URL()` is jsdom's class, which fileURLToPath refuses.
/** Where the harness keeps core's font files. */
export const HOST_FONTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../app/fonts/core')
export const HOST_FONTS_README = 'README.md'
/** The variables core's layout binds on <html> (core's frontend/app/core-fonts.ts), in its order. */
export const CORE_FONT_VARIABLES: readonly string[] = ['--font-geist-sans', '--font-geist-mono', '--font-newsreader']

const FACES_HEADING = 'Faces'
const FILES_HEADING = 'Files'
const FACE_CELLS = 5
const FILE_CELLS = 2
/** A table row whose first cell is a name in backticks. */
const NAMED_ROW = /^\|\s*`/

export interface HostFace {
  readonly file: string
  readonly variable: string
  readonly weight: string
  readonly style: string
  readonly licence: string
}

export interface PinnedFile {
  readonly file: string
  readonly sha256: string
}

export interface HostFonts {
  readonly faces: readonly HostFace[]
  readonly files: readonly PinnedFile[]
}

export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The text of the README's `## <heading>` section, up to the next one; a throw when it has none. */
function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`)
  if (start < 0) throw new Error(`${HOST_FONTS_README} in ${HOST_FONTS_DIR} has no "## ${heading}" section.`)
  const end = text.indexOf('\n## ', start + 1)
  return text.slice(start, end < 0 ? undefined : end)
}

/** Each named row's cells, without their backticks; a throw for a row with another number of cells. */
function tableRows(section: string, cells: number): string[][] {
  return section.split('\n').map((line) => line.trim()).filter((line) => NAMED_ROW.test(line)).map((line) => {
    const row = line.slice(1, -1).split('|').map((cell) => cell.trim().replace(/^`(.*)`$/, '$1'))
    if (row.length !== cells) throw new Error(`${HOST_FONTS_README}: "${line}" has ${row.length} cells, not ${cells}.`)
    return row
  })
}

/** The README's two tables. */
export function readHostFonts(): HostFonts {
  const text = readFileSync(join(HOST_FONTS_DIR, HOST_FONTS_README), 'utf8')
  const faceRows = tableRows(sectionOf(text, FACES_HEADING), FACE_CELLS)
  const faces = faceRows.map(([file = '', variable = '', weight = '', style = '', licence = '']): HostFace => (
    { file, variable, weight, style, licence }
  ))
  const files = tableRows(sectionOf(text, FILES_HEADING), FILE_CELLS).map(([file = '', sha256 = '']) => ({ file, sha256 }))
  return { faces, files }
}
