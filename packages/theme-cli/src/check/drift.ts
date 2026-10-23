/**
 * The `clonedFrom` check: each cloned page against the core page file it copied.
 *
 * A port of core's orchestrator/services/themes/drift.py (`stale_clones`) and review_stage.py
 * (`clone_check`) at the commit report.ts's CORE_SHA names. A theme page in `mode: "clone"` names
 * the core file it was copied from and that file's sha256 at the time (`clonedFrom {path, sha}`);
 * the core release's hashes of those files are `data/core-pages.json`, vendored byte for byte in
 * src/core/data. When the release changed a file a clone copied (or no longer ships it), the two
 * hashes differ: the clone may miss fixes the core page has now, and the check is a warning.
 */
import { readFileSync } from 'node:fs'
import { byText } from '../collect.ts'
import { LEVEL_PASS, LEVEL_WARNING, type CheckEntry, type CheckText, type Manifest } from './report.ts'

/** The vendored copy of core's services/themes/data/core-pages.json. */
export const CORE_PAGES_FILE = new URL('../core/data/core-pages.json', import.meta.url)
const CLONE_MODE = 'clone'

export const STALE_CLONES = (
  '{count} cloned page(s) copied a core file this host has changed since, so the clone may miss '
  + 'fixes and features the core page has now.'
)

export interface StaleClone {
  readonly route: string
  readonly path: unknown
  readonly sha: unknown
  /** The release's hash of the file, or null when the release no longer ships it. */
  readonly releaseSha: string | null
}

export interface CloneEntry extends CheckEntry {
  readonly clones: readonly string[]
  readonly stale: readonly StaleClone[]
  readonly reason: string | null
}

type JsonObject = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** contract.py `core_page_hashes`: `{path: sha256}` of the core page files the release ships. */
export function corePageHashes(file: URL = CORE_PAGES_FILE): ReadonlyMap<string, string> {
  const document: unknown = JSON.parse(readFileSync(file, 'utf8'))
  const files = isRecord(document) ? document.files : undefined
  if (!isRecord(files)) throw new Error(`${file.pathname} has no "files" table of core page hashes.`)
  return new Map(Object.entries(files).map(([path, sha]): [string, string] => [path, String(sha)]))
}

function pagesOf(manifest: Manifest): Array<[string, unknown]> {
  return isRecord(manifest.pages) ? Object.entries(manifest.pages) : []
}

function releaseShaOf(release: ReadonlyMap<string, string>, path: unknown): string | null {
  return typeof path === 'string' ? release.get(path) ?? null : null
}

/** drift.py `_clone_is_stale`: a clone whose `clonedFrom.sha` isn't the release's hash of its path. */
function cloneIsStale(entry: unknown, release: ReadonlyMap<string, string>): entry is JsonObject & { clonedFrom: JsonObject } {
  if (!isRecord(entry) || entry.mode !== CLONE_MODE || !isRecord(entry.clonedFrom)) return false
  return releaseShaOf(release, entry.clonedFrom.path) !== (entry.clonedFrom.sha ?? null)
}

/** drift.py `stale_clones`: each cloned page whose `clonedFrom.sha` differs from the release's file hash. */
export function staleClones(manifest: Manifest, release: ReadonlyMap<string, string>): StaleClone[] {
  return pagesOf(manifest).flatMap(([route, entry]): StaleClone[] => {
    if (!cloneIsStale(entry, release)) return []
    const path = entry.clonedFrom.path ?? null
    return [{ route, path, sha: entry.clonedFrom.sha ?? null, releaseSha: releaseShaOf(release, path) }]
  })
}

/** review_stage.py `clone_check`: every cloned page, and the ones whose core file changed since. */
export function cloneCheck(manifest: Manifest, release: ReadonlyMap<string, string> = corePageHashes()): CloneEntry {
  const clones = pagesOf(manifest)
    .filter(([, entry]) => isRecord(entry) && entry.mode === CLONE_MODE)
    .map(([route]) => route)
    .sort(byText)
  const stale = staleClones(manifest, release)
  return {
    level: stale.length > 0 ? LEVEL_WARNING : LEVEL_PASS,
    clones,
    stale,
    reason: stale.length > 0 ? STALE_CLONES.replace('{count}', String(stale.length)) : null,
  }
}

/** The `clonedFrom` line: how many pages are clones, and each stale one. */
export function describeClones(entry: CloneEntry): CheckText {
  const items = entry.stale.map((clone) => (
    `${clone.route}: ${String(clone.path)} is ${clone.releaseSha ?? 'not shipped'} in this release, not ${String(clone.sha)}`
  ))
  const matching = `${entry.clones.length} cloned page(s), each matching the core file it copied.`
  return { text: entry.reason ?? (entry.clones.length > 0 ? matching : 'No cloned pages.'), items }
}
