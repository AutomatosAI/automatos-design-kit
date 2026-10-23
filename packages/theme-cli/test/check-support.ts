/**
 * The hello package changed one way per test, as core's review stage tests build theirs
 * (orchestrator/tests/test_prd261_review_stage.py `_checked`, over tests/fixtures/themes/build.py):
 * theme.json with top-level fields set (`uses: ["theme"]` unless a test sets it), dist/entry.js
 * replaced, then read by the reader's port and reviewed with `reviewChecked`.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkPackage } from '../src/check-package.ts'
import { reviewChecked, runCheck, type Rebuilder, type Reviewed, type ReviewOptions } from '../src/check/index.ts'
import type { SurfaceAreas } from '../src/check/uses.ts'
import { writeZip } from '../src/zip.ts'
import { folderFiles } from './hello-files.ts'

export const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
export const MANIFEST = 'theme.json'
export const ENTRY = 'dist/entry.js'
export const HELLO_ENTRY = readFileSync(join(HELLO_DIR, ENTRY), 'utf8')
export const SDK_IMPORT = "import { defineTheme } from '@automatos/theme-sdk'"
/** test_prd261_review_stage.py SURFACE: a small SDK, so a test doesn't depend on the vendored name list. */
export const SURFACE: SurfaceAreas = {
  theme: ['defineTheme'],
  chat: ['useChatController', 'useStartChat'],
  'pages/agents': ['useAgents'],
}

type Fields = Readonly<Record<string, unknown>>

export interface HelloChange {
  readonly entry?: string
  /** Top-level theme.json fields set over hello's. */
  readonly manifest?: Fields
  /** Files set (bytes or text) or, with null, dropped. */
  readonly replace?: Readonly<Record<string, Uint8Array | string | null>>
}

/** hello's theme.json with `fields` set, as package bytes (build.py `changed_manifest`). */
export function changedManifest(fields: Fields): Uint8Array {
  const hello = JSON.parse(readFileSync(join(HELLO_DIR, MANIFEST), 'utf8')) as Fields
  return new TextEncoder().encode(`${JSON.stringify({ ...hello, ...fields }, null, 2)}\n`)
}

/** hello's entry with its SDK import naming `names` (test_prd261_review_stage.py `_entry_importing`). */
export function entryImporting(names: string): string {
  return HELLO_ENTRY.replace(SDK_IMPORT, `import { ${names} } from '@automatos/theme-sdk'`)
}

/** The hello package's files with `change`, in path order. */
export function helloPackage(change: HelloChange = {}): Map<string, Uint8Array> {
  const files = folderFiles(HELLO_DIR)
  files.set(MANIFEST, changedManifest({ uses: ['theme'], ...change.manifest }))
  files.set(ENTRY, new TextEncoder().encode(change.entry ?? HELLO_ENTRY))
  Object.entries(change.replace ?? {}).forEach(([path, data]) => {
    if (data === null) files.delete(path)
    else files.set(path, typeof data === 'string' ? new TextEncoder().encode(data) : data)
  })
  return new Map(Array.from(files.keys()).sort().map((path) => [path, files.get(path) as Uint8Array]))
}

/** The changed hello package read as core's reader reads it, then reviewed (core's `_review`). */
export async function reviewHello(change: HelloChange = {}, options: ReviewOptions = { surface: SURFACE }): Promise<Reviewed> {
  const entries = Array.from(helloPackage(change), ([path, data]) => ({ path, data }))
  const checked = checkPackage(entries)
  if (checked.manifest === null) throw new Error(checked.errors.map((error) => `${error.code} ${error.message}`).join('\n'))
  const files = new Map(Array.from(checked.files, ([path, file]): [string, Uint8Array] => [path, file.data]))
  return reviewChecked(files, checked.manifest, writeZip(entries).length, options)
}

/** The review with no test surface: the SDK names are the vendored data/sdk-surface.json (core's `_review_on_this_host`). */
export function reviewOnThisHost(change: HelloChange = {}): Promise<Reviewed> {
  return reviewHello(change, {})
}

const folders: string[] = []

/** A temporary folder, removed by `removeTempFolders`. */
export function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-check-test-'))
  folders.push(folder)
  return folder
}

export function removeTempFolders(): void {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
}

/** A copy of the hello theme folder with `change` applied, for the command to check. */
export function helloFolder(change: HelloChange = {}): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  helloPackage(change).forEach((data, path) => {
    mkdirSync(dirname(join(theme, path)), { recursive: true })
    writeFileSync(join(theme, path), data)
  })
  Object.entries(change.replace ?? {}).forEach(([path, data]) => {
    if (data === null) rmSync(join(theme, path), { force: true })
  })
  return theme
}

export interface Ran {
  readonly code: number
  readonly out: readonly string[]
  readonly err: readonly string[]
}

/** runCheck with its lines collected; `rebuilder` stands in for the review job's rebuild. */
export async function ranCheck(argv: readonly string[], rebuilder?: () => Promise<Rebuilder>): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const code = await runCheck(argv, { out: (line) => out.push(line), err: (line) => err.push(line) }, process.cwd(), rebuilder)
  return { code, out, err }
}
