/**
 * Where `automatos-theme clone` (PRD-261 B-04c, clone.ts) reads a core page from, and the hash each file is held to.
 *
 * A route's core files are its PAGE_SOURCES entry (core's contract.py, vendored in core/package-manifest.ts), each a
 * path under core's frontend/. Each is fetched from the public core repo at the commit this kit vendors (CORE_REPO
 * and CORE_SHA in check/report.ts, the Source line of src/core/README.md): `<CORE_ORIGIN>/<repo>/raw/<sha>/frontend/
 * <path>`, which GitHub answers with a redirect to the file's bytes. The redirect is followed: what answers is trusted
 * only through its hash, never through its address. A file's sha256, CRLF read as LF (core's digest.py
 * `page_source_sha256`), must equal the hash the vendored core-pages.json holds for its path, the same table the
 * `clonedFrom` check of `check` reads (check/drift.ts).
 */
import { CORE_REPO, CORE_SHA } from './check/report.ts'
import { sha256Hex } from './digest.ts'

export const CORE_ORIGIN = 'https://github.com'
/** The folder of the core repo that PAGE_SOURCES paths are relative to. */
export const CORE_FRONTEND = 'frontend'
export const FETCH_TIMEOUT_SECONDS = 30
const MS_PER_SECOND = 1000
const CR = 0x0d
const LF = 0x0a
const PAGES_TABLE = 'core-pages.json'

/** One core file as fetched: its PAGE_SOURCES path, its bytes as served, and its page sha256. */
export interface CoreFile {
  readonly path: string
  readonly data: Uint8Array
  readonly sha: string
}

export type FetchedFiles =
  | { readonly ok: true; readonly files: readonly CoreFile[] }
  | { readonly ok: false; readonly problems: readonly string[] }

/** digest.py `page_source_sha256`: a core page file's sha256 in hex, each CRLF read as LF. */
export function pageSourceSha256(data: Uint8Array): string {
  return sha256Hex(data.filter((byte, index) => !(byte === CR && data[index + 1] === LF)))
}

/** The address of core's frontend/<path> at `sha`, each segment encoded (`[id]` is sent as `%5Bid%5D`). */
export function coreFileUrl(path: string, sha: string = CORE_SHA): string {
  const segments = [CORE_FRONTEND, ...path.split('/')].map((segment) => encodeURIComponent(segment)).join('/')
  return `${CORE_ORIGIN}/${CORE_REPO}/raw/${sha}/${segments}`
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The bytes core serves for `path`, or why there are none. */
async function fetchOne(path: string, fetchImpl: typeof fetch): Promise<Uint8Array | string> {
  const url = coreFileUrl(path)
  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_SECONDS * MS_PER_SECOND),
    })
    if (!response.ok) return `${path}: ${url} answered ${response.status}, not the file.`
    return new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    return `${path}: no answer from ${url} (${messageOf(error)}); each file is waited for ${FETCH_TIMEOUT_SECONDS} seconds.`
  }
}

/** The file, when its page sha256 is the one `release` (core-pages.json) holds for its path; else why not. */
function checkedFile(path: string, data: Uint8Array, release: ReadonlyMap<string, string>): CoreFile | string {
  const expected = release.get(path)
  if (expected === undefined) return `${path}: ${PAGES_TABLE} holds no hash for it, so the copy can't be checked.`
  const sha = pageSourceSha256(data)
  if (sha !== expected) {
    return `${path}: its sha256 is ${sha}, but ${PAGES_TABLE} holds ${expected} for it (${CORE_REPO} at ${CORE_SHA}).`
  }
  return { path, data, sha }
}

/**
 * Every one of `paths` fetched from the core repo at CORE_SHA and held to `release`: all the files, in the order
 * given, or every reason one can't be used (no answer, an answer that isn't the file, a hash that doesn't match).
 */
export async function fetchCoreFiles(
  paths: readonly string[],
  fetchImpl: typeof fetch,
  release: ReadonlyMap<string, string>,
): Promise<FetchedFiles> {
  const results = await Promise.all(paths.map(async (path) => {
    const data = await fetchOne(path, fetchImpl)
    return typeof data === 'string' ? data : checkedFile(path, data, release)
  }))
  const problems = results.filter((result): result is string => typeof result === 'string')
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, files: results.filter((result): result is CoreFile => typeof result !== 'string') }
}
