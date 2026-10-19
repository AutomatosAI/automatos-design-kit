/**
 * `pack` on core's hello theme: the package core accepts, named and hashed as core names it, and
 * nothing written for a theme core would refuse.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { checkPackage } from '../src/check-package.ts'
import { main, USAGE } from '../src/cli-main.ts'
import { collectThemeFiles } from '../src/collect.ts'
import { packageBaseName, packTheme, type PackManifest } from '../src/pack.ts'
import { readZip } from '../src/zip.ts'

const HELLO_DIR = fileURLToPath(new URL('./fixtures/core/hello/', import.meta.url))
const HELLO_NAME = 'automatos-e2e.hello-1.0.0'
/** core orchestrator/services/themes/digest.py `package_digest` of the hello folder at the vendored commit. */
const HELLO_DIGEST = '38b9333e778879f49d655efaa4007e4aeafaef140803145a187e441286ceb83f'
const HELLO_FILES = [
  'README.md', 'dist/entry.js', 'dist/theme.css', 'looks/presets/default.look.json', 'looks/presets/night.look.json',
  'looks/schema.json', 'theme.json',
]

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-pack-'))
  folders.push(folder)
  return folder
}

/** A copy of the hello theme, with the build's own files beside it, to change in a test. */
function helloCopy(): string {
  const theme = join(tempFolder(), 'hello')
  cpSync(HELLO_DIR, theme, { recursive: true })
  writeFileSync(join(theme, 'package.json'), '{"name": "hello-theme"}\n')
  writeFileSync(join(theme, 'vite.config.ts'), 'export default {}\n')
  writeFileSync(join(theme, '.DS_Store'), 'finder')
  return theme
}

function setManifest(theme: string, change: (manifest: Record<string, unknown>) => Record<string, unknown>): void {
  const path = join(theme, 'theme.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  writeFileSync(path, `${JSON.stringify(change(manifest), null, 2)}\n`)
}

describe('pack', () => {
  it('writes <publisher>.<slug>-<version>.autotheme holding exactly the package files', () => {
    const out = tempFolder()
    const result = packTheme(helloCopy(), out)
    if (!result.ok) throw new Error(result.errors.map((error) => error.message).join('\n'))
    expect(result.file).toBe(join(out, `${HELLO_NAME}.autotheme`))
    const entries = readZip(readFileSync(result.file))
    expect(entries.map((entry) => entry.path)).toEqual(HELLO_FILES)
    entries.forEach((entry) => {
      expect(Buffer.from(entry.data).equals(readFileSync(join(HELLO_DIR, entry.path)))).toBe(true)
    })
  })

  it("names the package by core's digest and writes the sha256 manifest", () => {
    const out = tempFolder()
    const result = packTheme(helloCopy(), out)
    if (!result.ok) throw new Error('the hello theme must pack')
    expect(result.manifest.digest).toBe(HELLO_DIGEST)
    const written = JSON.parse(readFileSync(join(out, `${HELLO_NAME}.sha256.json`), 'utf8')) as PackManifest
    expect(written).toEqual(result.manifest)
    expect(written.id).toBe('automatos-e2e/hello')
    expect(written.version).toBe('1.0.0')
    expect(Object.keys(written.files)).toEqual(HELLO_FILES)
    expect(written.files['dist/theme.css'].type).toBe('text/css')
    expect(written.files['dist/entry.js'].type).toBe('text/javascript')
  })

  it('gives the same bytes every time', () => {
    const first = packTheme(helloCopy(), tempFolder())
    const second = packTheme(helloCopy(), tempFolder())
    if (!first.ok || !second.ok) throw new Error('the hello theme must pack')
    expect(readFileSync(first.file).equals(readFileSync(second.file))).toBe(true)
    expect(first.manifest.zipSha256).toBe(second.manifest.zipSha256)
  })

  it('packs a package the reader accepts when read back from the zip', () => {
    const result = packTheme(helloCopy(), tempFolder())
    if (!result.ok) throw new Error('the hello theme must pack')
    const reread = checkPackage(readZip(readFileSync(result.file)))
    expect(reread.errors).toEqual([])
  })

  it('leaves the build files and dotfiles out', () => {
    const paths = collectThemeFiles(helloCopy()).map((entry) => entry.path)
    expect(paths).toEqual(HELLO_FILES)
  })
})

describe('pack refuses what core refuses, and writes nothing', () => {
  function expectRefused(theme: string, code: string): void {
    const out = tempFolder()
    const result = packTheme(theme, out)
    if (result.ok) throw new Error(`expected ${code}, the theme packed`)
    expect(result.errors.map((error) => error.code)).toContain(code)
    expect(existsSync(join(out, `${HELLO_NAME}.autotheme`))).toBe(false)
  }

  it('a theme without lookEditor@1', () => {
    const theme = helloCopy()
    setManifest(theme, (manifest) => ({ ...manifest, slots: ['frame@1', 'styleSheet@1'] }))
    expectRefused(theme, 'MISSING_SLOT')
  })

  it('a theme without styleSheet@1', () => {
    const theme = helloCopy()
    setManifest(theme, (manifest) => ({ ...manifest, slots: ['frame@1', 'lookEditor@1'] }))
    expectRefused(theme, 'MISSING_SLOT')
  })

  it('a source map left in dist/', () => {
    const theme = helloCopy()
    writeFileSync(join(theme, 'dist', 'entry.js.map'), '{}')
    expectRefused(theme, 'NOT_ALLOWED')
  })

  it('CSS outside the theme class', () => {
    const theme = helloCopy()
    writeFileSync(join(theme, 'dist', 'theme.css'), 'body { color: red; }\n')
    expectRefused(theme, 'CSS_UNSCOPED')
  })

  it('an entry over 300 KB', () => {
    const theme = helloCopy()
    writeFileSync(join(theme, 'dist', 'entry.js'), `// ${'x'.repeat(300 * 1024)}\n`)
    expectRefused(theme, 'ENTRY_TOO_LARGE')
  })

  it('a symbolic link', () => {
    const theme = helloCopy()
    symlinkSync(join(theme, 'README.md'), join(theme, 'looks', 'linked.look.json'))
    expectRefused(theme, 'SYMLINK')
  })

  it('a theme with no theme.json', () => {
    const theme = helloCopy()
    rmSync(join(theme, 'theme.json'))
    expectRefused(theme, 'MISSING_FILE')
  })
})

describe('the automatos-theme command', () => {
  function run(argv: readonly string[]): { code: number; out: string[]; err: string[] } {
    const out: string[] = []
    const err: string[] = []
    const code = main(argv, { out: (line) => out.push(line), err: (line) => err.push(line) })
    return { code, out, err }
  }

  it('packs into --out and prints the file and digest', () => {
    const out = tempFolder()
    const { code, out: lines } = run(['pack', helloCopy(), '--out', out])
    expect(code).toBe(0)
    expect(lines[0]).toContain(`${HELLO_NAME}.autotheme`)
    expect(lines[0]).toContain(HELLO_DIGEST)
    expect(existsSync(join(out, `${HELLO_NAME}.autotheme`))).toBe(true)
  })

  it('exits 1 with every reason when core would refuse the theme', () => {
    const theme = helloCopy()
    setManifest(theme, (manifest) => ({ ...manifest, htmlClass: 'studio' }))
    const { code, err } = run(['pack', theme, '--out', tempFolder()])
    expect(code).toBe(1)
    expect(err.join('\n')).toContain('RESERVED_HTML_CLASS')
  })

  it.each([[[]], [['build', 'x']], [['pack']], [['pack', 'a', 'b']], [['pack', 'a', '--zip']]])(
    'exits 2 on %j',
    (argv) => {
      const { code, err } = run(argv)
      expect(code).toBe(2)
      expect(err).toEqual([USAGE])
    },
  )

  it('names a package from its id and version', () => {
    expect(packageBaseName('automatos/play', '1.0.0')).toBe('automatos.play-1.0.0')
  })
})
