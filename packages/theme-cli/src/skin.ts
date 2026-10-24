/**
 * `automatos-theme skin <theme folder> --from <skin.json>`: a skin, the `mobile` block the harness's skin designer
 * exports (skin.json holds exactly the block), written into the theme's theme.json as its `mobile` field, the rest of
 * the file's layout kept (theme-json.ts `withField`: the old block replaced where it stands, or the field added last).
 *
 * Nothing is written unless every check passes; otherwise every reason is printed (skin-check.ts `checkSkin`):
 *
 * - the block against the vendored validator (core/mobile-manifest.ts, with the theme's top-level `mascot` and
 *   `engines`), then, once it passes, the files it names (each font, and each mascot state's files for `clips` or
 *   `stills`) and `check`'s own contrast measure (check/mobile-contrast.ts): no pair under its minimum, no colour set
 *   without a ground or text. There is no flag to write a failing pair. For each failing pair of a tokens block the
 *   nearest passing value of its first token is printed too (phone/nearest-passing.ts);
 * - a released theme: a folder inside the kit's own released themes (RELEASED_FOLDERS, the `themes/` entries of
 *   new/index.ts KIT_FOLDERS_KEPT: themes/play and themes/hud, whose packed files the released-files guard freezes and
 *   which Automatos Go draws with its own built-in layouts, reading none of the block), followed through links; or a
 *   theme of the `automatos` publisher (new/index.ts RESERVED_PUBLISHERS), Automatos's own;
 * - a theme folder without a theme.json that is a JSON object, and a skin.json that isn't JSON.
 *
 * The theme's files are read from its folder: a file is the theme's when it is a regular file inside the folder (a
 * link is not, as pack refuses one). The command reads the folder and the skin file and writes only theme.json; it
 * sends nothing anywhere.
 * Exit code 0 when written, 1 when refused (every reason printed, nothing written), 2 for a usage error.
 */
import { lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { CommandDeps } from './cli-main.ts'
import { isRecord, own, PREPAINT_PATH, type JsonRecord, type ThemeError } from './core/css-value.ts'
import { within } from './dev-server.ts'
import { parseJson } from './json.ts'
import { presetPaths, PRESETS_DIR } from './looks.ts'
import { KIT_FOLDERS_KEPT, KIT_ROOT, RESERVED_PUBLISHERS } from './new/index.ts'
import type { Output } from './output.ts'
import { checkSkin, MOBILE_FIELD, skinFixes, type SkinFiles, type SkinFix } from './skin-check.ts'
import { withField } from './theme-json.ts'

export const SKIN_USAGE = 'usage: automatos-theme skin <theme folder> --from <skin.json>'
/** The kit's released themes, by folder from its root: KIT_FOLDERS_KEPT's themes. */
export const RELEASED_FOLDERS: readonly string[] = KIT_FOLDERS_KEPT.filter((folder) => folder.startsWith('themes/'))

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const MANIFEST_FILE = 'theme.json'
const BOM = '﻿'

interface SkinArgs {
  readonly themeDir: string
  readonly from: string
}

interface Theme {
  readonly text: string
  readonly document: JsonRecord
}

/** The theme folder and the skin file from the arguments, or null when they don't make one command. */
export function parseSkin(argv: readonly string[], cwd: string): SkinArgs | null {
  try {
    const { positionals, values } = parseArgs({ args: [...argv], allowPositionals: true, options: { from: { type: 'string' } } })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'skin' || themeDir === undefined || extra.length > 0 || values.from === undefined) return null
    return { themeDir: resolve(cwd, themeDir), from: resolve(cwd, values.from) }
  } catch {
    return null
  }
}

/** True when `path` (a package path) is a regular file inside the theme folder; a link is not. */
function holds(themeDir: string, path: string): boolean {
  const file = resolve(themeDir, path)
  if (!within(themeDir, file)) return false
  try {
    return lstatSync(file).isFile()
  } catch {
    return false
  }
}

/** The package paths of the files in looks/presets/, or none when the folder can't be listed. */
function presetNames(themeDir: string): string[] {
  try {
    return readdirSync(join(themeDir, PRESETS_DIR)).map((name) => `${PRESETS_DIR}${name}`)
  } catch {
    return []
  }
}

/** The files `check`'s measure reads under fromLooks: the presets and the prepaint table, by package path. */
function measuredFiles(themeDir: string): Map<string, Uint8Array> {
  const paths = [...presetPaths(presetNames(themeDir)), PREPAINT_PATH].filter((path) => holds(themeDir, path))
  return new Map(paths.map((path): [string, Uint8Array] => [path, new Uint8Array(readFileSync(join(themeDir, path)))]))
}

/** theme.json's text and what it parses to, or why it can't be read. */
function readTheme(themeDir: string): Theme | string {
  const path = join(themeDir, MANIFEST_FILE)
  if (!holds(themeDir, MANIFEST_FILE)) return `${themeDir} has no ${MANIFEST_FILE}: skin takes a theme folder.`
  const text = readFileSync(path, 'utf8')
  try {
    const document: unknown = JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text)
    return isRecord(document) ? { text, document } : `${path} is not a JSON object.`
  } catch (error) {
    return `${path} can't be read as JSON (${String(error)}).`
  }
}

/** The skin file's JSON, the block, or why it can't be read. */
function readBlock(from: string): { readonly block: unknown } | string {
  let raw: Uint8Array
  try {
    raw = new Uint8Array(readFileSync(from))
  } catch {
    return `${from}: there is no such file to read the skin from.`
  }
  const { data, error } = parseJson(raw, from)
  return error === null ? { block: data } : error.message
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Why the theme is not one skin writes: a released theme of the kit's, or one of Automatos's own. */
export function releasedProblems(themeDir: string, document: JsonRecord, kitRoot: string): string[] {
  const real = realPath(themeDir)
  const folder = RELEASED_FOLDERS.find((kept) => within(realPath(join(kitRoot, kept)), real))
  const id = own(document, 'id')
  const publisher = typeof id === 'string' ? id.split('/')[0] : ''
  return [
    ...(folder === undefined ? [] : [(
      `${themeDir} is inside the kit's ${folder}/, a released theme: its packed files change only with a new version, `
      + 'and Automatos Go draws it in its own built-in layout, reading none of the block.'
    )]),
    ...(RESERVED_PUBLISHERS.includes(publisher) ? [`"${String(id)}" is one of Automatos's own themes: skin writes your own theme's block.`] : []),
  ]
}

const errorLine = (error: ThemeError): string => `${error.code} ${error.path}: ${error.message}`
const fixLine = (fix: SkinFix): string => (
  `nearest passing: mobile.tokens.${fix.scheme}.${fix.token} "${fix.value}" (on ${fix.background})`
)

function refused(output: Output, themeDir: string, problems: readonly string[], fixes: readonly SkinFix[] = []): number {
  output.err(`automatos-theme skin: nothing was written to ${themeDir}, because:`)
  problems.forEach((problem) => output.err(`  ${problem}`))
  fixes.forEach((fix) => output.err(`  ${fixLine(fix)}`))
  return EXIT_REFUSED
}

/** Runs `skin` in the folder `cwd`, the kit at `kitRoot` (tests pass their own folder); returns the exit code. */
export function runSkin(argv: readonly string[], output: Output, cwd: string, kitRoot: string = KIT_ROOT): number {
  const args = parseSkin(argv, cwd)
  if (args === null) {
    output.err(SKIN_USAGE)
    return EXIT_USAGE
  }
  const theme = readTheme(args.themeDir)
  if (typeof theme === 'string') return refused(output, args.themeDir, [theme])
  const released = releasedProblems(args.themeDir, theme.document, kitRoot)
  const read = readBlock(args.from)
  if (typeof read === 'string') return refused(output, args.themeDir, [...released, read])
  const files: SkinFiles = { has: (path) => holds(args.themeDir, path), measured: measuredFiles(args.themeDir) }
  const checked = checkSkin(theme.document, read.block, files)
  const problems = [...released, ...checked.problems.map(errorLine)]
  if (problems.length > 0) return refused(output, args.themeDir, problems, skinFixes(read.block, checked.measure))
  writeFileSync(join(args.themeDir, MANIFEST_FILE), withField(theme.text, theme.document, MOBILE_FIELD, read.block))
  output.out(`${join(args.themeDir, MANIFEST_FILE)}: its ${MOBILE_FIELD} block is now ${args.from}.`)
  if (checked.measure !== null) output.out(`contrast: ${checked.measure.reason}`)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS). */
export function skinCommand(argv: readonly string[], output: Output, deps: CommandDeps): number {
  return runSkin(argv, output, deps.cwd)
}
