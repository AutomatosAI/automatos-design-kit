/**
 * `automatos-theme new <publisher/name> [--template minimal|full] [--mascot none] [--to <folder>]` (PRD-261 B-03f):
 * a new theme folder, from one of the kit's templates, that builds, packs and checks as it is. With no `--template`
 * it is `minimal`, the one a theme of its own design starts from.
 *
 * - `minimal` (templates/minimal): the frame only, with the host's pages inside it, a look editor and a style sheet,
 *   its look data written by hand. Its placeholders are filled with the theme's names (placeholders.ts).
 * - `full`: Play de-branded, made from themes/play when the theme is made (full.ts): every slot, page and route Play
 *   has, under the theme's names, and a cloned core page. `--mascot none` leaves Auto's drawing out (no-mascot.ts).
 *
 * The theme's id is `publisher/name`, as theme.json's: the name is also its class on <html> and its folder's
 * name, so it is 3 to 32 lower-case letters and digits in words joined by single dashes, starting with a letter. The
 * `automatos` publisher is core's (contract.py RESERVED_PUBLISHERS) and the classes core keeps on <html> are no
 * theme's (the vendored package-manifest.ts RESERVED_HTML_CLASSES). `--to` (default `themes/<name>`, from the folder
 * the command runs in) must not exist yet: nothing is ever written over. Nor may it be inside the kit's own folders
 * the command reads (KIT_FOLDERS_KEPT): a theme written into Play or HUD would change a released package, and one
 * written into a template would be copied into every theme made from it.
 *
 * Exit code 0 when the folder is written; 1 when the theme can't be made (a reserved name, an existing folder, a
 * folder of the kit's, a rename that would merge two of Play's names), every reason printed and nothing written; 2
 * for a usage error.
 * A theme written into the kit's own `themes/` keeps its template's tsconfig.json, extending the kit's base as Play's
 * and HUD's do; one written anywhere else gets a tsconfig.json that stands alone (tsconfig.ts).
 * The command reads the kit's own folders and writes only `--to`; it sends nothing anywhere.
 */
import { existsSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { CommandDeps } from '../cli-main.ts'
import { HTML_CLASS_PATTERN } from '../core/host.ts'
import { ID_PATTERN, RESERVED_HTML_CLASSES } from '../core/package-manifest.ts'
import { within } from '../dev-server.ts'
import type { Output } from '../output.ts'
import { fullTheme } from './full.ts'
import { copyTemplate, placeholderValues, themeNames, writeFolder, type ThemeNames } from './placeholders.ts'
import { writeThemeTsconfig } from './tsconfig.ts'

export const NEW_USAGE = 'usage: automatos-theme new <publisher/name> [--template minimal|full] [--mascot none] [--to <folder>]'
export const TEMPLATES = ['minimal', 'full'] as const
export type TemplateName = (typeof TEMPLATES)[number]
/** The template a theme starts from when `--template` is left out: the frame alone, for a design of its own. */
export const DEFAULT_TEMPLATE: TemplateName = 'minimal'
/** contract.py RESERVED_PUBLISHERS: the publishers only core's own themes may name. */
export const RESERVED_PUBLISHERS: readonly string[] = ['automatos']
export const NO_MASCOT = 'none'
/** Where a theme lives in the kit, from the kit's root (AGENTS.md, "Layout"). */
export const THEMES_DIR = 'themes'
/** The kit's root, from this file (packages/theme-cli/src/new/). */
export const KIT_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
/**
 * The kit's folders, from its root, no theme is written into: the released themes (Play and HUD, whose packed files the
 * released-files guard freezes), the templates, the packages (the themes bundle two).
 */
export const KIT_FOLDERS_KEPT: readonly string[] = ['themes/play', 'themes/hud', 'templates', 'packages']
/** A theme's name: words of lower-case letters and digits, joined by single dashes, starting with a letter. */
const NAME_WORDS = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2

export interface NewCommand {
  readonly id: string
  readonly template: TemplateName
  readonly mascot: boolean
  readonly target: string
}

function isTemplate(value: string | undefined): value is TemplateName {
  return TEMPLATES.some((name) => name === value)
}

/** The command from the arguments, or null when they don't make one (`--mascot none` belongs to full alone). */
export function parseNew(argv: readonly string[], cwd: string): NewCommand | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { template: { type: 'string' }, mascot: { type: 'string' }, to: { type: 'string' } },
    })
    const [command, id, ...extra] = positionals
    const template = values.template ?? DEFAULT_TEMPLATE
    if (command !== 'new' || id === undefined || extra.length > 0 || !isTemplate(template)) return null
    if (values.mascot !== undefined && (values.mascot !== NO_MASCOT || template !== 'full')) return null
    const target = resolve(cwd, values.to ?? join(THEMES_DIR, id.split('/').at(-1) ?? id))
    return { id, template, mascot: values.mascot !== NO_MASCOT, target }
  } catch {
    return null
  }
}

/** Why `target` can't be written: it is inside one of the kit's folders that `new` only reads. */
function keptFolderProblems(target: string, kitRoot: string): string[] {
  const kept = KIT_FOLDERS_KEPT.find((folder) => within(join(kitRoot, folder), target))
  return kept === undefined ? [] : [`${target} is inside the kit's ${kept}/, which new only reads: pick a --to outside it.`]
}

/** Every reason `command` can't be made in the kit at `kitRoot`, before anything is read or written. */
export function refusals(command: NewCommand, kitRoot: string): string[] {
  if (!ID_PATTERN.test(command.id)) {
    return [`"${command.id}" is not a theme id: publisher/name, in lower-case letters, digits and dashes.`]
  }
  const [publisher, name] = command.id.split('/')
  return [
    ...(RESERVED_PUBLISHERS.includes(publisher)
      ? [`The publisher "${publisher}" is reserved for Automatos's own themes: name your own.`] : []),
    ...(NAME_WORDS.test(name) && HTML_CLASS_PATTERN.test(name) ? [] : [(
      `"${name}" can't be the theme's name: it is also its class on <html>, so 3 to 32 lower-case letters and digits, `
      + 'in words joined by single dashes, starting with a letter.'
    )]),
    ...(RESERVED_HTML_CLASSES.includes(name) ? [`"${name}" is a class core keeps on <html>, so no theme may take it.`] : []),
    ...(existsSync(command.target) ? [`${command.target} is there already: new never writes over a folder. Pick another --to.`] : []),
    ...keptFolderProblems(command.target, kitRoot),
  ]
}

/** Writes the theme `command` asks for; the paths written, or the reasons it can't be. */
function writeTheme(command: NewCommand, names: ThemeNames, kitRoot: string): { readonly written: number } | { readonly problems: readonly string[] } {
  if (command.template === 'minimal') {
    const written = copyTemplate(join(kitRoot, 'templates', 'minimal'), command.target, placeholderValues(names)).length
    writeThemeTsconfig(command.target, kitRoot, join(kitRoot, THEMES_DIR))
    return { written }
  }
  const made = fullTheme({ names, mascot: command.mascot, kitRoot })
  if (!made.ok) return { problems: made.problems }
  writeFolder(command.target, made.files)
  writeThemeTsconfig(command.target, kitRoot, join(kitRoot, THEMES_DIR))
  return { written: made.files.length }
}

/** The folder as the next lines name it: from the folder the command ran in when inside it, else in full. */
function shownPath(target: string, cwd: string): string {
  const from = relative(cwd, target)
  if (from === '') return '.'
  return from.startsWith('..') || isAbsolute(from) ? target : from
}

/** What to do next, from the folder the command ran in: build, see, check, pack, install. */
export function nextLines(command: NewCommand, cwd: string): string[] {
  const shown = shownPath(command.target, cwd)
  const steps: readonly (readonly [string, string])[] = [
    [`(cd ${shown} && npm run build)`, 'build it'],
    [`npx automatos-theme dev ${shown}`, 'see it, at http://127.0.0.1:4319/ (and /phone)'],
    [`npx automatos-theme check ${shown}`, "the server's checks, before you install"],
    [`npx automatos-theme pack ${shown} --out out`, 'the .autotheme file: Settings > Appearance > Themes > Install theme'],
  ]
  const width = Math.max(...steps.map(([run]) => run.length))
  return [
    'next:',
    ...steps.map(([run, what]) => `  ${run.padEnd(width)}   ${what}`),
    'A theme folder under the kit\'s themes/ is a new npm workspace: if npm ci later says package-lock.json is out of sync, run npm install once.',
  ]
}

/** Runs `new` in `cwd` against the kit at `kitRoot` (tests pass their own folder); returns the exit code. */
export function runNew(argv: readonly string[], output: Output, cwd: string, kitRoot: string = KIT_ROOT): number {
  const command = parseNew(argv, cwd)
  if (command === null) {
    output.err(NEW_USAGE)
    return EXIT_USAGE
  }
  const refused = refusals(command, kitRoot)
  const result = refused.length > 0 ? { problems: refused } : writeTheme(command, themeNames(command.id), kitRoot)
  if ('problems' in result) {
    output.err(`automatos-theme new ${command.id}: nothing was written.`)
    result.problems.forEach((problem) => output.err(`  ${problem}`))
    return EXIT_REFUSED
  }
  const mascot = command.template === 'full' && !command.mascot ? ' with no mascot' : ''
  output.out(`${command.target}: ${command.id} from the ${command.template} template${mascot}, ${result.written} files.`)
  nextLines(command, cwd).forEach((line) => output.out(line))
  return EXIT_OK
}

/** The command table's runner (cli-main.ts): `new`, in the folder `deps.cwd`; it uses no network. */
export function newCommand(argv: readonly string[], output: Output, deps: CommandDeps): number {
  return runNew(argv, output, deps.cwd)
}
