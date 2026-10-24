/**
 * `automatos-theme clone <route> [<theme folder>]` (PRD-261 B-04c) on a copy of core's hello theme in a temporary
 * folder, with a mocked fetch: nothing here reaches the network. Each of the route's PAGE_SOURCES files is asked for
 * at the public core repo's raw address at the vendored core SHA, held to core-pages.json's sha256 (CRLF read as LF,
 * as core's digest.py does), and written read-only under reference/core/<path>, never under src/; theme.json's
 * pages[route] becomes `{"mode": "clone", "clonedFrom": {path, sha}}`, which core's manifest validator and the
 * clonedFrom check accept, and pack packs none of reference/. A hash that doesn't match, a failed fetch, a host-owned
 * route and a route outside PAGE_SOURCES each write nothing and exit 1. The served files are made up: a test that
 * goes through the CLI's own table (the vendored hashes) can only see them refused.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cloneCheck, corePageHashes } from '../src/check/drift.ts'
import { CORE_SHA } from '../src/check/report.ts'
import { run, type CommandDeps } from '../src/cli-main.ts'
import { coreFileUrl, pageSourceSha256 } from '../src/clone-source.ts'
import { REFERENCE_DIR } from '../src/clone-theme.ts'
import { CLONE_USAGE, PAGE_GUIDE, runClone } from '../src/clone.ts'
import { collectThemeFiles } from '../src/collect.ts'
import { PAGE_SOURCES, validateManifest } from '../src/core/package-manifest.ts'
import { sha256Hex } from '../src/digest.ts'
import { packTheme } from '../src/pack.ts'
import { readZip } from '../src/zip.ts'
import { HELLO_DIR, helloFolder, removeTempFolders, tempFolder } from './check-support.ts'

afterEach(removeTempFolders)

const MANIFEST = 'theme.json'
const CHAT = '/chat'
const AGENTS = '/agents'
const ASSIGNMENTS = '/assignments'
const MISSION = '/missions/[id]'
/** Every file is asked for here: the public core repo at the commit src/core/README.md names, under frontend/. */
const CORE_RAW = `https://github.com/AutomatosAI/automatos-ai/raw/${CORE_SHA}/frontend/`
const WRITE_BITS = 0o222
const NOT_FOUND = 404
const ZERO_SHA = '0'.repeat(64)

type Served = Readonly<Record<string, string>>

interface Ran {
  readonly code: number
  readonly out: readonly string[]
  readonly err: readonly string[]
  readonly urls: readonly string[]
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

/** A made-up body for each core file, `tag` telling two clones of the same file apart. */
function served(paths: readonly string[], tag = 'first'): Served {
  return Object.fromEntries(paths.map((path) => [path, `// core's ${path} (${tag}), as this test serves it\nexport {}\n`]))
}

/** The vendored core-pages.json with `files` hashed in, as a release that shipped them would hold them. */
function releaseOf(files: Served): Map<string, string> {
  const hashed = Object.entries(files).map(([path, body]): [string, string] => [path, pageSourceSha256(encode(body))])
  return new Map<string, string>([...corePageHashes(), ...hashed])
}

/** A fetch that answers each served file at its core address, and 404 for any other; it records every url asked. */
function coreServer(files: Served, urls: string[]): typeof fetch {
  const answer = async (input: unknown): Promise<Response> => {
    urls.push(String(input))
    const path = Object.keys(files).find((candidate) => coreFileUrl(candidate) === String(input))
    return path === undefined ? new Response('Not Found', { status: NOT_FOUND }) : new Response(files[path])
  }
  return answer as typeof fetch
}

async function ranClone(argv: readonly string[], files: Served, release = releaseOf(files), cwd = process.cwd()): Promise<Ran> {
  const out: string[] = []
  const err: string[] = []
  const urls: string[] = []
  const output = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }
  const code = await runClone(['clone', ...argv], output, { fetch: coreServer(files, urls), cwd, release })
  return { code, out, err, urls }
}

/** Every file under `folder`, relative to it with forward slashes, in order. */
function filesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .map((path) => path.split('\\').join('/'))
    .filter((path) => statSync(join(folder, path)).isFile())
    .sort()
}

/** The theme folder's files and theme.json's text, to show a refusal wrote nothing. */
function snapshot(theme: string): { readonly files: string[]; readonly manifest: string } {
  return { files: filesUnder(theme), manifest: readFileSync(join(theme, MANIFEST), 'utf8') }
}

function manifestOf(theme: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(theme, MANIFEST), 'utf8')) as Record<string, unknown>
}

const lastOf = (route: string): string => PAGE_SOURCES[route][PAGE_SOURCES[route].length - 1]

describe('automatos-theme clone writes the reference and the page entry', () => {
  it("fetches the route's core files at the vendored core SHA and writes them read-only under reference/core/", async () => {
    const theme = helloFolder()
    const before = filesUnder(theme)
    const files = served(PAGE_SOURCES[CHAT])
    const ran = await ranClone([CHAT, theme], files)
    expect([ran.code, ran.err]).toEqual([0, []])
    expect(ran.urls).toEqual(PAGE_SOURCES[CHAT].map((path) => `${CORE_RAW}${path}`))
    const added = filesUnder(theme).filter((path) => !before.includes(path))
    expect(added).toEqual(PAGE_SOURCES[CHAT].map((path) => `${REFERENCE_DIR}/${path}`).sort())
    PAGE_SOURCES[CHAT].forEach((path) => {
      const file = join(theme, REFERENCE_DIR, path)
      expect(readFileSync(file, 'utf8')).toBe(files[path])
      expect(statSync(file).mode & WRITE_BITS).toBe(0)
    })
    expect(ran.out.join('\n')).toContain(PAGE_GUIDE)
  })

  it("sets pages[route] to mode clone with clonedFrom, the route's last core file, keeping theme.json's layout", async () => {
    const theme = helloFolder()
    // core's own hello theme.json, its lists each on one line, as an author may lay theme.json out.
    const original = readFileSync(join(HELLO_DIR, MANIFEST), 'utf8')
    writeFileSync(join(theme, MANIFEST), original)
    const files = served(PAGE_SOURCES[CHAT])
    const release = releaseOf(files)
    expect((await ranClone([CHAT, theme], files, release)).code).toBe(0)
    const document = manifestOf(theme)
    const sha = release.get(lastOf(CHAT))
    expect(document.pages).toEqual({ [CHAT]: { mode: 'clone', clonedFrom: { path: lastOf(CHAT), sha } } })
    expect(validateManifest(document).errors).toEqual([])
    expect(cloneCheck(document, release)).toMatchObject({ level: 'pass', clones: [CHAT], stale: [] })
    const kept = original.slice(0, original.lastIndexOf('}')).trimEnd()
    const written = readFileSync(join(theme, MANIFEST), 'utf8')
    expect(kept).toContain('"slots": ["frame@1", "lookEditor@1", "styleSheet@1"]')
    expect(written.startsWith(kept)).toBe(true)
  })

  it('asks for a path with brackets with each segment encoded, and records the path as PAGE_SOURCES names it', async () => {
    const theme = helloFolder()
    const ran = await ranClone([MISSION, theme], served(PAGE_SOURCES[MISSION]))
    expect([ran.code, ran.urls]).toEqual([0, [`${CORE_RAW}app/missions/%5Bid%5D/page.tsx`]])
    expect(manifestOf(theme).pages).toMatchObject({ [MISSION]: { clonedFrom: { path: 'app/missions/[id]/page.tsx' } } })
  })

  it('holds a file served with CRLF line ends to its LF hash, as core does, and writes it as served', async () => {
    expect(pageSourceSha256(encode('a\r\nb\r\n'))).toBe(sha256Hex('a\nb\n'))
    expect(pageSourceSha256(encode('a\rb'))).toBe(sha256Hex('a\rb'))
    const theme = helloFolder()
    const [path] = PAGE_SOURCES[ASSIGNMENTS]
    const lf = served([path])
    const crlf = { [path]: lf[path].split('\n').join('\r\n') }
    expect((await ranClone([ASSIGNMENTS, theme], crlf, releaseOf(lf))).code).toBe(0)
    expect(readFileSync(join(theme, REFERENCE_DIR, path), 'utf8')).toBe(crlf[path])
  })

  it('clones into the folder it runs in when no theme folder is given', async () => {
    const theme = helloFolder()
    const ran = await ranClone([ASSIGNMENTS], served(PAGE_SOURCES[ASSIGNMENTS]), undefined, theme)
    expect(ran.code).toBe(0)
    expect(filesUnder(theme)).toContain(`${REFERENCE_DIR}/${PAGE_SOURCES[ASSIGNMENTS][0]}`)
  })

  it("a second clone replaces the read-only copy and the sha, and keeps the page's keepCorePage list", async () => {
    const theme = helloFolder({ manifest: { pages: { [AGENTS]: { mode: 'own', keepCorePage: ['tab'] } } } })
    expect((await ranClone([AGENTS, theme], served(PAGE_SOURCES[AGENTS]))).code).toBe(0)
    const second = served(PAGE_SOURCES[AGENTS], 'second')
    const release = releaseOf(second)
    expect((await ranClone([AGENTS, theme], second, release)).code).toBe(0)
    const file = join(theme, REFERENCE_DIR, lastOf(AGENTS))
    expect([readFileSync(file, 'utf8'), statSync(file).mode & WRITE_BITS]).toEqual([second[lastOf(AGENTS)], 0])
    expect(manifestOf(theme).pages).toEqual({
      [AGENTS]: { mode: 'clone', keepCorePage: ['tab'], clonedFrom: { path: lastOf(AGENTS), sha: release.get(lastOf(AGENTS)) } },
    })
  })
})

describe('pack never packs reference/', () => {
  it('leaves every cloned file out of the package, which still carries the page entry', async () => {
    const theme = helloFolder()
    expect((await ranClone([CHAT, theme], served(PAGE_SOURCES[CHAT]))).code).toBe(0)
    expect(collectThemeFiles(theme).filter((entry) => entry.path.startsWith('reference/'))).toEqual([])
    const packed = packTheme(theme, join(tempFolder(), 'out'))
    if (!packed.ok) throw new Error(`pack refused the clone: ${JSON.stringify(packed.errors)}`)
    const paths = readZip(readFileSync(packed.file)).map((entry) => entry.path)
    expect(paths).toContain(MANIFEST)
    expect(paths.filter((path) => path.startsWith('reference/'))).toEqual([])
    expect(Object.keys(packed.manifest.files).filter((path) => path.startsWith('reference/'))).toEqual([])
  })
})

describe('automatos-theme clone refuses, writing nothing', () => {
  it("a hash that isn't core-pages.json's: exit 1, through the CLI's own command, at the vendored core SHA", async () => {
    const theme = helloFolder()
    const before = snapshot(theme)
    const urls: string[] = []
    const err: string[] = []
    const deps: CommandDeps = { env: {}, fetch: coreServer(served(PAGE_SOURCES[CHAT]), urls), cwd: process.cwd() }
    const code = await run(['clone', CHAT, theme], { out: () => undefined, err: (line) => err.push(line) }, deps)
    expect(code).toBe(1)
    expect(urls).toEqual(PAGE_SOURCES[CHAT].map((path) => `${CORE_RAW}${path}`))
    expect(err[0]).toBe(`automatos-theme clone: nothing was written to ${theme}, because:`)
    PAGE_SOURCES[CHAT].forEach((path, index) => {
      expect(err[index + 1]).toContain(`${path}: its sha256 is `)
      expect(err[index + 1]).toContain(`core-pages.json holds ${corePageHashes().get(path)} for it`)
    })
    expect(snapshot(theme)).toEqual(before)
  })

  it('one file matching and one not: neither is written, and theme.json is unchanged', async () => {
    const theme = helloFolder()
    const before = snapshot(theme)
    const [page, shell] = PAGE_SOURCES[CHAT]
    const files = served([page, shell])
    const release = new Map<string, string>([...releaseOf(files), [shell, ZERO_SHA]])
    const ran = await ranClone([CHAT, theme], files, release)
    expect([ran.code, ran.err.length]).toEqual([1, 2])
    expect(ran.err[1]).toContain(`${shell}: its sha256 is `)
    expect(snapshot(theme)).toEqual(before)
  })

  it('an answer that is not the file, or no answer: exit 1', async () => {
    const theme = helloFolder()
    const before = snapshot(theme)
    const missing = await ranClone([CHAT, theme], {})
    expect(missing.code).toBe(1)
    expect(missing.err.slice(1)).toEqual(PAGE_SOURCES[CHAT].map((path) => `  ${path}: ${CORE_RAW}${path} answered 404, not the file.`))
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const err: string[] = []
    const code = await runClone(['clone', CHAT, theme], { out: () => undefined, err: (line) => err.push(line) }, {
      fetch: offline, cwd: process.cwd(), release: corePageHashes(),
    })
    expect(code).toBe(1)
    expect(err[1]).toContain(`no answer from ${CORE_RAW}${PAGE_SOURCES[CHAT][0]} (fetch failed)`)
    expect(snapshot(theme)).toEqual(before)
  })

  it.each([
    ['/settings', 'host'], ['/settings/billing', 'host'], ['/x/hello', 'host'], ['/marketplace', 'host'],
    ['/nowhere', 'outside'], ['/chat/extra', 'outside'], ['chat', 'outside'],
  ])('%s (%s): exit 1 before anything is fetched', async (route, kind) => {
    const theme = helloFolder()
    const before = snapshot(theme)
    const ran = await ranClone([route, theme], served(PAGE_SOURCES[CHAT]))
    const reason = kind === 'host'
      ? `"${route}" is a host page: a theme can't replace it, so it can't be cloned.`
      : `"${route}" is not a page a theme may clone: ${Object.keys(PAGE_SOURCES).join(', ')}.`
    expect([ran.code, ran.err, ran.urls]).toEqual([1, [`automatos-theme clone: nothing was written to ${theme}, because:`, `  ${reason}`], []])
    expect(snapshot(theme)).toEqual(before)
  })

  it('a folder with no theme.json: exit 1, nothing fetched', async () => {
    const folder = tempFolder()
    const ran = await ranClone([CHAT, folder], served(PAGE_SOURCES[CHAT]))
    expect([ran.code, ran.err[1], ran.urls]).toEqual([1, `  ${folder} has no theme.json: clone takes a theme folder.`, []])
    expect(filesUnder(folder)).toEqual([])
  })

  it.each([[[]], [[CHAT, 'a', 'b']], [[CHAT, '--force']]])('%j: the usage, exit 2', async (argv) => {
    const ran = await ranClone(argv, {})
    expect([ran.code, ran.err, ran.urls]).toEqual([2, [CLONE_USAGE], []])
  })
})
