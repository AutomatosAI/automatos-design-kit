/**
 * A real Vite build through the preset is a production build whatever NODE_ENV or --mode it runs
 * under. The Marketplace review rebuilds a package with NODE_ENV unset, and Vite takes
 * import.meta.env.DEV and PROD from NODE_ENV and MODE from the mode, so an author building under
 * NODE_ENV=development (or a test runner's NODE_ENV=test) must still write the bytes the review's
 * rebuild writes. Each case builds the same folder twice, so only the environment differs.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { automatosTheme } from '../src/index.ts'

type Files = Readonly<Record<string, string>>

const ENTRY_PATH = 'src/entry.js'
const MANIFEST = JSON.stringify({ htmlClass: 'hello' })
const ENV_READS = [
  'export const dev = import.meta.env.DEV',
  'export const prod = import.meta.env.PROD',
  'export const mode = import.meta.env.MODE',
]
/** A production build's values, written as literals. */
const PRODUCTION_LITERALS = [
  'export const dev = false',
  'export const prod = true',
  'export const mode = "production"',
]
/** The whole object, as a vendored library reads it (zustand: `import.meta.env ? import.meta.env.MODE : void 0`). */
const WHOLE_ENV = [
  'export const libraryMode = import.meta.env ? import.meta.env.MODE : void 0',
  'export const env = { ...import.meta.env }',
]

/** How a build is run: NODE_ENV (undefined unsets it, as the review job has it) and Vite's --mode. */
interface BuildEnv {
  readonly nodeEnv: string | undefined
  readonly mode?: string
}

/** The review's rebuild: NODE_ENV unset, Vite's default mode. */
const REVIEW: BuildEnv = { nodeEnv: undefined }

interface Built {
  readonly files: readonly string[]
  readonly entry: string
}

const roots: string[] = []

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

/** A theme folder in the system temp directory whose entry holds `lines`. */
function themeFolder(lines: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'automatos-preset-env-'))
  roots.push(root)
  const files: Files = { 'theme.json': MANIFEST, [ENTRY_PATH]: `${lines.join('\n')}\n` }
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  })
  return root
}

/** Every file under `dir`, as sorted paths relative to it. */
function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((dirent): string[] => {
    const path = prefix ? `${prefix}/${dirent.name}` : dirent.name
    return dirent.isDirectory() ? listFiles(dir, path) : [path]
  }).sort()
}

/** Runs `work` with NODE_ENV set to `nodeEnv` (or unset), then puts the runner's value back. */
async function withNodeEnv<T>(nodeEnv: string | undefined, work: () => Promise<T>): Promise<T> {
  const saved = process.env.NODE_ENV
  if (nodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = nodeEnv
  try {
    return await work()
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = saved
  }
}

/** Build the folder with the preset under `env`, as the review builds it, and read its dist/. */
async function buildIn(root: string, env: BuildEnv): Promise<Built> {
  await withNodeEnv(env.nodeEnv, () => build({
    root,
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    mode: env.mode,
    plugins: [automatosTheme({ entry: ENTRY_PATH })],
  }))
  const dist = join(root, 'dist')
  return { files: listFiles(dist), entry: readFileSync(join(dist, 'entry.js'), 'utf8') }
}

describe('a theme that reads import.meta.env, built with the preset', () => {
  it.each<[string, BuildEnv]>([
    ['NODE_ENV=development', { nodeEnv: 'development' }],
    ['NODE_ENV=test', { nodeEnv: 'test' }],
    ['--mode development', { nodeEnv: undefined, mode: 'development' }],
  ])('writes the same bytes under %s as the review rebuild (NODE_ENV unset)', async (_name, env) => {
    const root = themeFolder([...ENV_READS, ...WHOLE_ENV])
    const review = await buildIn(root, REVIEW)
    const author = await buildIn(root, env)
    expect(author.files).toEqual(review.files)
    expect(author.entry).toBe(review.entry)
  })

  it('reads DEV false, PROD true and MODE "production" under NODE_ENV=development', async () => {
    const root = themeFolder(ENV_READS)
    const author = await buildIn(root, { nodeEnv: 'development' })
    writeFileSync(join(root, ENTRY_PATH), `${PRODUCTION_LITERALS.join('\n')}\n`)
    const literals = await buildIn(root, REVIEW)
    expect(author.entry).toBe(literals.entry)
  })
})
