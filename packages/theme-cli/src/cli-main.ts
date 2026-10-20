/**
 * The `automatos-theme` command line: `automatos-theme pack <theme folder> [--out <folder>]` and
 * `automatos-theme submit <file.autotheme>` (submit.ts).
 *
 * `pack` checks the theme folder as core's reader would and writes
 * `<publisher>.<slug>-<version>.autotheme` and its `.sha256.json` manifest to `--out` (default:
 * the current folder). Exit code 0 when written, 1 when the theme was refused (every reason is
 * printed, one per line), 2 for a usage error.
 */
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { Output } from './output.ts'
import { packTheme } from './pack.ts'
import { submitCommand, SUBMIT_USAGE, type SubmitDeps } from './submit.ts'

export type { Output } from './output.ts'

export const USAGE = ['usage: automatos-theme pack <theme folder> [--out <folder>]', SUBMIT_USAGE].join('\n')
const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2

interface Command {
  readonly themeDir: string
  readonly outDir: string
}

/** The pack command's folders from the arguments, or null when they don't make one. */
function parsePack(argv: readonly string[], cwd: string): Command | null {
  try {
    const { positionals, values } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: { out: { type: 'string' } },
    })
    const [command, themeDir, ...extra] = positionals
    if (command !== 'pack' || themeDir === undefined || extra.length > 0) return null
    return { themeDir: resolve(cwd, themeDir), outDir: resolve(cwd, values.out ?? '.') }
  } catch {
    return null
  }
}

/** Runs the command line; returns the exit code. */
export function main(argv: readonly string[], output: Output, cwd: string = process.cwd()): number {
  const command = parsePack(argv, cwd)
  if (command === null) {
    output.err(USAGE)
    return EXIT_USAGE
  }
  const result = packTheme(command.themeDir, command.outDir)
  if (!result.ok) {
    output.err(`${command.themeDir} can't be packed: the Automatos server would refuse it.`)
    result.errors.forEach((error) => output.err(`  ${error.code} ${error.path}: ${error.message}`))
    return EXIT_REFUSED
  }
  output.out(`${result.file} ${result.bytes} bytes, digest ${result.manifest.digest}`)
  output.out(`${result.manifestFile}`)
  return EXIT_OK
}

/** The environment, network and folder the real command uses. */
function processDeps(): SubmitDeps {
  return { env: process.env, fetch: globalThis.fetch, cwd: process.cwd() }
}

/** Runs any command: `submit` (which waits on the network), else `main`; returns the exit code. */
export async function run(argv: readonly string[], output: Output, deps: SubmitDeps = processDeps()): Promise<number> {
  if (argv[0] === 'submit') return submitCommand(argv, output, deps)
  return main(argv, output, deps.cwd)
}
