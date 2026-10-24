/**
 * `automatos-theme clone <route> [<theme folder>]` (PRD-261 B-04c): a core page's source, fetched by its pinned hash,
 * as a reading reference for a theme that redraws the page, and theme.json's `pages[route]` set to the clone.
 *
 * The route must be one of the pages a theme may replace: a key of PAGE_SOURCES (core's contract.py, vendored in
 * core/package-manifest.ts). A host-owned route, or any other, is refused before anything is fetched. Each of the
 * route's core files is fetched from the public core repo at the commit this kit vendors and held to the vendored
 * core-pages.json's hash of it (clone-source.ts). Only when every file matches is anything written: the files,
 * read-only, under <theme folder>/reference/core/<path>, never under src/, and theme.json's `pages[route]` as
 * `{"mode": "clone", "clonedFrom": {"path", "sha"}}` (clone-theme.ts). `clonedFrom` names the route's last core file,
 * the component that draws the page (as the full template's /agents clone does); a single-file route names its one.
 *
 * The copy is for reading only: a theme can't import core's code, so the page is redrawn in src/ on the SDK's page
 * area (guides/page-inventory.md), and pack never packs reference/. Once a later host changes the file, `check`
 * warns at `clonedFrom`; running clone again fetches the file at the kit's commit then and moves the sha with it.
 * The theme folder defaults to the folder the command runs in. Exit code 0 when written, 1 when refused (every
 * reason printed, nothing written), 2 for a usage error.
 */
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { corePageHashes } from './check/drift.ts'
import { CORE_REPO, CORE_SHA } from './check/report.ts'
import type { CommandDeps } from './cli-main.ts'
import { fetchCoreFiles, type CoreFile } from './clone-source.ts'
import {
  MANIFEST_FILE, readThemeManifest, REFERENCE_DIR, writeClonedPage, writeReference, type ThemeManifest,
} from './clone-theme.ts'
import { echo, hasOwn } from './core/css-value.ts'
import { HOST_OWNED_ROUTES, PAGE_SOURCES } from './core/package-manifest.ts'
import type { Output } from './output.ts'

export const CLONE_USAGE = 'usage: automatos-theme clone <route> [<theme folder>]'
/** The guide that maps each page to the SDK hooks a redrawn page reads. */
export const PAGE_GUIDE = 'guides/page-inventory.md'

const EXIT_OK = 0
const EXIT_REFUSED = 1
const EXIT_USAGE = 2
const DEFAULT_THEME_DIR = '.'

/** What clone needs beside its arguments: the network, the folder it runs in and the release's page hashes. */
export interface CloneDeps {
  readonly fetch: typeof fetch
  readonly cwd: string
  /** `{path: sha256}` of the core page files (the vendored core-pages.json, check/drift.ts `corePageHashes`). */
  readonly release: ReadonlyMap<string, string>
}

interface CloneArgs {
  readonly route: string
  readonly themeDir: string
}

/** The route and theme folder from the arguments, or null when they don't make one command. */
function parseClone(argv: readonly string[], cwd: string): CloneArgs | null {
  try {
    const { positionals } = parseArgs({ args: [...argv], allowPositionals: true, options: {} })
    const [command, route, themeDir, ...extra] = positionals
    if (command !== 'clone' || route === undefined || extra.length > 0) return null
    return { route, themeDir: resolve(cwd, themeDir ?? DEFAULT_THEME_DIR) }
  } catch {
    return null
  }
}

/** package-manifest.ts's host-owned rule: the route itself or any page under it. */
function isHostOwned(route: string): boolean {
  return HOST_OWNED_ROUTES.some((owned) => route === owned || route.startsWith(`${owned}/`))
}

/** The core files a clone of `route` copies, or why the route can't be cloned. */
export function routeSources(route: string): readonly string[] | string {
  if (isHostOwned(route)) return `"${echo(route)}" is a host page: a theme can't replace it, so it can't be cloned.`
  if (!hasOwn(PAGE_SOURCES, route)) {
    return `"${echo(route)}" is not a page a theme may clone: ${Object.keys(PAGE_SOURCES).join(', ')}.`
  }
  return PAGE_SOURCES[route]
}

function refused(output: Output, themeDir: string, problems: readonly string[]): number {
  output.err(`automatos-theme clone: nothing was written to ${themeDir}, because:`)
  problems.forEach((problem) => output.err(`  ${problem}`))
  return EXIT_REFUSED
}

/** Writes the clone and prints what was written and what to do next. */
function writeClone(args: CloneArgs, theme: ThemeManifest, files: readonly CoreFile[], output: Output): void {
  const written = writeReference(args.themeDir, files)
  const copied = files[files.length - 1]
  writeClonedPage(args.themeDir, theme, args.route, copied)
  output.out(`${args.route}: ${files.length} core file(s) from ${CORE_REPO} at ${CORE_SHA}, each matching core-pages.json:`)
  written.forEach((path) => output.out(`  ${path} (read-only)`))
  output.out(`${MANIFEST_FILE}: pages["${args.route}"] is a clone of ${copied.path}, sha256 ${copied.sha}.`)
  output.out(
    `${REFERENCE_DIR}/ is for reading and is never packed: redraw the page in src/ on the SDK's page area `
    + `(${PAGE_GUIDE}) and register it with host.registerPage("${args.route}", ...).`,
  )
}

/** Runs `clone` with `deps`; returns the exit code. */
export async function runClone(argv: readonly string[], output: Output, deps: CloneDeps): Promise<number> {
  const args = parseClone(argv, deps.cwd)
  if (args === null) {
    output.err(CLONE_USAGE)
    return EXIT_USAGE
  }
  const sources = routeSources(args.route)
  if (typeof sources === 'string') return refused(output, args.themeDir, [sources])
  const theme = readThemeManifest(args.themeDir)
  if (typeof theme === 'string') return refused(output, args.themeDir, [theme])
  const fetched = await fetchCoreFiles(sources, deps.fetch, deps.release)
  if (!fetched.ok) return refused(output, args.themeDir, fetched.problems)
  writeClone(args, theme, fetched.files, output)
  return EXIT_OK
}

/** The command table's runner (cli-main.ts COMMANDS): the network the CLI was given, and the vendored page hashes. */
export function cloneCommand(argv: readonly string[], output: Output, deps: CommandDeps): Promise<number> {
  return runClone(argv, output, { fetch: deps.fetch, cwd: deps.cwd, release: corePageHashes() })
}
