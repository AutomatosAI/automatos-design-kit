/**
 * `pack` writes source/ from the theme's src/ (PRD-261 C-06p1): byte for byte, covered by the digest,
 * and refused, writing nothing, when the review could not rebuild it or core would not take it as
 * source. Play, packed with its source, stays within the server's caps.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { main } from '../src/cli-main.ts'
import { PACKED_FOLDERS } from '../src/collect.ts'
import { packageDigest, sha256Hex, type FileRow } from '../src/digest.ts'
import { CAPS, fileKind, MAX_MEMBERS } from '../src/files.ts'
import { packTheme, type PackManifest } from '../src/pack.ts'
import { SOURCE_ENTRY_CANDIDATES, SOURCE_FOLDER, SOURCE_MAX_DEPTH } from '../src/source.ts'
import { readZip } from '../src/zip.ts'

const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
const HELLO_NAME = 'automatos-e2e.hello-1.0.0'
/** core's `package_digest` of the hello folder (pack.test.ts): a theme without src/ keeps it. */
const HELLO_DIGEST = '38b9333e778879f49d655efaa4007e4aeafaef140803145a187e441286ceb83f'
const PLAY_DIR = fileURLToPath(new URL('../../../themes/play/', import.meta.url))
const PLAY_ENTRY = 'dist/entry.js'
const PLAY_PACK_TIMEOUT_MS = 60_000
const SRC_FILES: Readonly<Record<string, string>> = {
  'entry.ts': "import './theme.css'\nexport { mount } from './lib/mount'\n",
  'theme.css': '.hello-frame { min-height: 100vh; }\n',
  'lib/mount.ts': 'export function mount(): void {}\n',
  'lib/data/names.json': '{"hello": "Hello"}\n',
}

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-source-'))
  folders.push(folder)
  return folder
}

function writeFile(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}

/** Core's hello theme with a src/ (and a dotfile in it), to change in a test. */
function helloWithSrc(): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  Object.entries(SRC_FILES).forEach(([path, text]) => writeFile(join(theme, 'src', path), text))
  writeFile(join(theme, 'src', '.DS_Store'), 'finder')
  writeFile(join(theme, 'src', 'lib', '.cache', 'note.ts'), 'export {}\n')
  return theme
}

function helloWithoutSrc(): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  return theme
}

describe('pack writes source/ from src/', () => {
  it('packs every non-dot src/ file as source/<same path>, byte for byte', () => {
    const result = packTheme(helloWithSrc(), tempFolder())
    if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('\n'))
    const source = readZip(readFileSync(result.file)).filter((entry) => entry.path.startsWith(`${SOURCE_FOLDER}/`))
    expect(source.map((entry) => entry.path)).toEqual(Object.keys(SRC_FILES).map((path) => `${SOURCE_FOLDER}/${path}`).sort())
    source.forEach((entry) => {
      expect(Buffer.from(entry.data).toString('utf8')).toBe(SRC_FILES[entry.path.slice(SOURCE_FOLDER.length + 1)])
    })
    expect(result.warnings).toEqual([])
  })

  it('covers source/ in the .sha256.json rows and the digest', () => {
    const out = tempFolder()
    const result = packTheme(helloWithSrc(), out)
    if (!result.ok) throw new Error('hello with a src/ must pack')
    const written = JSON.parse(readFileSync(join(out, `${HELLO_NAME}.sha256.json`), 'utf8')) as PackManifest
    Object.entries(SRC_FILES).forEach(([path, text]) => {
      const row: FileRow | undefined = written.files[`${SOURCE_FOLDER}/${path}`]
      const type = fileKind(`${SOURCE_FOLDER}/${path}`)?.contentType
      expect(row).toEqual({ type, size: Buffer.byteLength(text), sha256: sha256Hex(text) })
    })
    const hashes = Object.fromEntries(readZip(readFileSync(result.file)).map((entry) => [entry.path, sha256Hex(entry.data)]))
    expect(written.digest).toBe(packageDigest(hashes))
    expect(written.digest).not.toBe(HELLO_DIGEST)
  })

  it('never reads a source/ folder from disk', () => {
    expect(PACKED_FOLDERS).not.toContain(SOURCE_FOLDER)
  })

  it('packs a file exactly the deepest source/ holds', () => {
    const theme = helloWithSrc()
    const deepest = `${Array.from({ length: SOURCE_MAX_DEPTH - 1 }, (_, index) => `d${index}`).join('/')}/deep.ts`
    writeFile(join(theme, 'src', deepest), 'export {}\n')
    const result = packTheme(theme, tempFolder())
    if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('\n'))
    expect(Object.keys(result.manifest.files)).toContain(`${SOURCE_FOLDER}/${deepest}`)
  })
})

describe('a theme with no src/', () => {
  it("packs with one warning, and core's hello digest is unchanged", () => {
    const result = packTheme(helloWithoutSrc(), tempFolder())
    if (!result.ok) throw new Error('the hello theme must pack')
    expect(result.manifest.digest).toBe(HELLO_DIGEST)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('src/')
  })

  it('prints the warning once, on stderr, and exits 0', () => {
    const out: string[] = []
    const err: string[] = []
    const output = { out: (line: string) => out.push(line), err: (line: string) => err.push(line) }
    const code = main(['pack', helloWithoutSrc(), '--out', tempFolder()], output)
    expect(code).toBe(0)
    expect(err).toHaveLength(1)
    expect(err[0]).toMatch(/^warning: .*src\//)
    expect(out[0]).toContain(HELLO_DIGEST)
  })
})

type Seed = (theme: string) => void

const REFUSALS: ReadonlyArray<readonly [string, Seed, string, readonly string[]]> = [
  ['a source/ folder on disk', (theme) => writeFile(join(theme, 'source', 'entry.ts'), 'export {}\n'), 'SOURCE_ON_DISK', ['source/']],
  [
    'a src file of a kind source/ can not hold',
    (theme) => writeFile(join(theme, 'src', 'logo.png'), 'png'),
    'SOURCE_NOT_ALLOWED',
    ['src/logo.png', 'source/logo.png'],
  ],
  [
    'a src file name with a space',
    (theme) => writeFile(join(theme, 'src', 'my file.ts'), 'export {}\n'),
    'SOURCE_NOT_ALLOWED',
    ['src/my file.ts', 'source/my file.ts'],
  ],
  [
    'a src file more than 8 levels deep',
    (theme) => writeFile(join(theme, 'src', 'a/b/c/d/e/f/g/h/deep.ts'), 'export {}\n'),
    'SOURCE_NOT_ALLOWED',
    ['src/a/b/c/d/e/f/g/h/deep.ts', 'source/a/b/c/d/e/f/g/h/deep.ts', '9 levels'],
  ],
  [
    'a src file over 1 MB',
    (theme) => writeFile(join(theme, 'src', 'big.txt'), 'x'.repeat(1024 * 1024 + 1)),
    'SOURCE_NOT_ALLOWED',
    ['src/big.txt', 'source/big.txt', '1024 KB'],
  ],
  [
    'a src file that is not UTF-8',
    (theme) => writeFile(join(theme, 'src', 'bad.ts'), new Uint8Array([0xff, 0xfe, 0x00])),
    'SOURCE_NOT_ALLOWED',
    ['src/bad.ts', 'source/bad.ts', 'UTF-8'],
  ],
  [
    'a symbolic link under src/',
    (theme) => symlinkSync(join(theme, 'README.md'), join(theme, 'src', 'linked.md')),
    'SOURCE_LINK',
    ['src/linked.md', 'source/linked.md'],
  ],
  [
    'src/ itself a symbolic link',
    (theme) => {
      const real = join(dirname(theme), 'real-src')
      cpSync(join(theme, 'src'), real, { recursive: true })
      rmSync(join(theme, 'src'), { recursive: true })
      symlinkSync(real, join(theme, 'src'))
    },
    'SOURCE_LINK',
    ['src'],
  ],
  ['no entry module', (theme) => rmSync(join(theme, 'src', 'entry.ts')), 'NO_SOURCE_ENTRY', SOURCE_ENTRY_CANDIDATES.map((name) => `src/${name}`)],
  [
    'two entry modules',
    (theme) => writeFile(join(theme, 'src', 'entry.js'), 'export {}\n'),
    'SEVERAL_SOURCE_ENTRIES',
    ['src/entry.ts', 'src/entry.js'],
  ],
]

describe('pack refuses a src/ the review could not rebuild, and writes nothing', () => {
  it.each(REFUSALS)('%s', (_name, seed, code, named) => {
    const theme = helloWithSrc()
    seed(theme)
    const out = tempFolder()
    const result = packTheme(theme, out)
    if (result.ok) throw new Error(`expected ${code}, the theme packed`)
    const refusal = result.errors.find((error) => error.code === code)
    expect(refusal, result.errors.map((error) => error.code).join(', ')).toBeDefined()
    named.forEach((text) => expect(refusal?.message).toContain(text))
    expect(readdirSync(out)).toEqual([])
  })

  it('exits 1 from the command, with the refusal', () => {
    const theme = helloWithSrc()
    writeFile(join(theme, 'source', 'entry.ts'), 'export {}\n')
    const err: string[] = []
    const code = main(['pack', theme, '--out', tempFolder()], { out: () => undefined, err: (line) => err.push(line) })
    expect(code).toBe(1)
    expect(err.join('\n')).toContain('SOURCE_ON_DISK')
  })
})

describe("Play, packed with its source/, stays within the server's caps", () => {
  it('members, package size and each source file', () => {
    if (!existsSync(join(PLAY_DIR, PLAY_ENTRY))) {
      throw new Error(`themes/play/${PLAY_ENTRY} is missing: Play's build runs before the tests (npm run build)`)
    }
    const result = packTheme(PLAY_DIR, tempFolder())
    if (!result.ok) throw new Error(result.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('\n'))
    const entries = readZip(readFileSync(result.file))
    const source = entries.filter((entry) => entry.path.startsWith(`${SOURCE_FOLDER}/`))
    expect(entries.length).toBeLessThanOrEqual(MAX_MEMBERS)
    expect(result.bytes).toBeLessThanOrEqual(CAPS.package)
    expect(source.map((entry) => entry.path)).toContain(`${SOURCE_FOLDER}/entry.ts`)
    source.forEach((entry) => expect(entry.data.length).toBeLessThanOrEqual(fileKind(entry.path)?.cap ?? 0))
    expect(result.warnings).toEqual([])
  }, PLAY_PACK_TIMEOUT_MS)
})
