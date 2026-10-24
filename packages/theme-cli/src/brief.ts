/**
 * `automatos-theme brief --brand-kit <file.json> --out <file.md>` (PRD-261 B-04a): a theme's brief from a brand kit,
 * so a branded theme starts from the brand's real colours and voice.
 *
 * The brand kit is a file: the answer of the local edition's `GET /api/documents/brand-kit` saved as JSON
 * (brief-kit.ts reads it). The command sends nothing and reads no address or token. It writes one Markdown file,
 * usually `briefs/<slug>/BRIEF.md`, in the sections of `skills/brand-a-theme/references/brief-template.md`
 * (brief-markdown.ts): the brand, the palette's roles as ground and accent candidates, every proposed text pair with
 * its WCAG ratio (brief-colours.ts, on @automatos/look-kit's contrast math; a pair is proposed only at 4.5:1 or
 * more), the fonts, the logo variants and the voice, then what the brand kit can't decide. It never copies the
 * kit's company contact details or social handles.
 *
 * Refused, writing nothing and printing every reason: a `--brand-kit` that is not a file, not JSON, not an object,
 * without a palette or with a colour role that is not a hex colour; an `--out` that is there already (a brief is
 * finished by hand, so it is never written over).
 * Exit code 0 when written, 1 when refused, 2 for a usage error.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { briefColours } from './brief-colours.ts'
import { readBriefKit } from './brief-kit.ts'
import { briefMarkdown } from './brief-markdown.ts'
import { WARNING_PREFIX, type CommandDeps } from './cli-main.ts'
import { parseJson } from './json.ts'
import type { Output } from './output.ts'

export const BRIEF_USAGE = 'usage: automatos-theme brief --brand-kit <file.json> --out <file.md>'

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
/** Write only when no file is there: a brief that already exists is someone's, finished by hand. */
const WRITE_NEW_ONLY = 'wx'

interface BriefArgs {
  readonly kitFile: string
  readonly outFile: string
}

/** The two files from the arguments, or null when they don't make one command. */
export function parseBrief(argv: readonly string[], cwd: string): BriefArgs | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { 'brand-kit': { type: 'string' }, out: { type: 'string' } },
    })
    const kit = values['brand-kit']
    if (positionals.length !== 1 || positionals[0] !== 'brief' || kit === undefined || values.out === undefined) return null
    return { kitFile: resolve(cwd, kit), outFile: resolve(cwd, values.out) }
  } catch {
    return null
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** The brief's text from the brand kit file, or every reason it can't be made. */
function briefText(kitFile: string): { readonly text: string; readonly unmet: number } | string[] {
  if (!isFile(kitFile)) return [`${kitFile} is not a file: --brand-kit takes the brand kit saved as JSON.`]
  const parsed = parseJson(new Uint8Array(readFileSync(kitFile)), basename(kitFile))
  if (parsed.error !== null) return [`${parsed.error.message} --brand-kit takes the brand kit saved as JSON.`]
  const kit = readBriefKit(parsed.data)
  if (Array.isArray(kit)) return kit.map((problem) => `${basename(kitFile)}: ${problem}`)
  const colours = briefColours(kit)
  return { text: briefMarkdown(kit, colours, basename(kitFile)), unmet: colours.notProposed.length }
}

/** Writes `text` to `outFile` unless a file is there; null when written, else why not. */
function writeBrief(outFile: string, text: string): string | null {
  if (existsSync(outFile)) return `${outFile} is there already: brief never writes over a brief, which may hold your own words. Pick another --out.`
  try {
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, text, { flag: WRITE_NEW_ONLY })
    return null
  } catch (error) {
    return `${outFile} can't be written (${error instanceof Error ? error.message : String(error)}).`
  }
}

function refused(output: Output, problems: readonly string[]): number {
  output.err('automatos-theme brief: nothing was written, because:')
  problems.forEach((problem) => output.err(`  ${problem}`))
  return EXIT_REFUSED
}

/** Runs `brief` in the folder `cwd`; returns the exit code. */
export function runBrief(argv: readonly string[], output: Output, cwd: string): number {
  const args = parseBrief(argv, cwd)
  if (args === null) {
    output.err(BRIEF_USAGE)
    return EXIT_USAGE
  }
  const made = briefText(args.kitFile)
  if (Array.isArray(made)) return refused(output, made)
  const problem = writeBrief(args.outFile, made.text)
  if (problem !== null) return refused(output, [problem])
  output.out(args.outFile)
  output.out('Every proposed pair reads at 4.5:1 or more. Next: finish its Theme section, then write the look data from it.')
  if (made.unmet > 0) output.err(`${WARNING_PREFIX}${made.unmet} pair(s) stayed under 4.5:1; the brief lists them as not proposed.`)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS). */
export function briefCommand(argv: readonly string[], output: Output, deps: CommandDeps): number {
  return runBrief(argv, output, deps.cwd)
}
