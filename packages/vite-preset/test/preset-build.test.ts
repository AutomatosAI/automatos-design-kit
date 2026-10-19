/**
 * A real Vite build of a small theme through the preset, written to its dist/ in the system temp
 * folder: the JS keeps the import map's modules as imports, the CSS (global and CSS modules) comes
 * out as one wrapped dist/theme.css that passes the server's check, and a theme importing sonner or
 * shipping !important does not build.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { cssScopeErrors } from '../src/css-scope.ts'
import { automatosTheme, type ThemePresetOptions } from '../src/index.ts'

type Files = Readonly<Record<string, string>>

const ENTRY = [
  "import { defineTheme } from '@automatos/theme-sdk'",
  "import { jsx } from 'react/jsx-runtime'",
  "import './theme.css'",
  "import styles from './frame.module.css'",
  '',
  'function Frame(props) {',
  "  return jsx('div', { className: styles.frame, children: props.children })",
  '}',
  '',
  'export default defineTheme({',
  '  register(host) {',
  "    host.registerSlot('frame@1', Frame)",
  '  },',
  '})',
  '',
].join('\n')

const GLOBAL_CSS = [
  ':root { --hello-accent: #2f6fed; }',
  '.hello-bar { color: var(--hello-accent); animation: pulse 2s; font-family: "Hello Sans", serif; }',
  '@keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }',
  '@font-face { font-family: "Hello Sans"; src: local("Arial"); }',
  '@media (min-width: 600px) { .hello-bar { padding: 4px; } }',
  '',
].join('\n')

const MODULE_CSS = [
  '.frame { animation: spin 1s linear infinite; }',
  '@keyframes spin { to { transform: rotate(1turn); } }',
  '',
].join('\n')

const HELLO: Files = {
  'theme.json': JSON.stringify({ htmlClass: 'hello' }),
  'src/entry.js': ENTRY,
  'src/theme.css': GLOBAL_CSS,
  'src/frame.module.css': MODULE_CSS,
}

const roots: string[] = []

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

/** A theme folder in the system temp directory holding `files`. */
function themeFolder(files: Files): string {
  const root = mkdtempSync(join(tmpdir(), 'automatos-preset-'))
  roots.push(root)
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  })
  return root
}

interface Built {
  readonly files: readonly string[]
  readonly entry: string
  readonly css: string
}

/** Every file under `dir`, as sorted paths relative to it. */
function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((dirent): string[] => {
    const path = prefix ? `${prefix}/${dirent.name}` : dirent.name
    return dirent.isDirectory() ? listFiles(dir, path) : [path]
  }).sort()
}

/** Build `files` with the preset into the theme folder's dist/ and read what it wrote. */
async function buildTheme(files: Files, options: ThemePresetOptions = {}): Promise<Built> {
  const root = themeFolder(files)
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [automatosTheme({ entry: 'src/entry.js', ...options })],
  })
  const dist = join(root, 'dist')
  return {
    files: listFiles(dist),
    entry: readFileSync(join(dist, 'entry.js'), 'utf8'),
    css: readFileSync(join(dist, 'theme.css'), 'utf8'),
  }
}

describe('a theme built with the preset', () => {
  it('leaves the import map modules to the host', async () => {
    const code = (await buildTheme(HELLO)).entry
    expect(code).toMatch(/from\s*["']@automatos\/theme-sdk["']/)
    expect(code).toMatch(/from\s*["']react\/jsx-runtime["']/)
    expect(code).toContain('hello-frame-')
  })

  it('emits one stylesheet, wrapped, renamed and passing the server check', async () => {
    const built = await buildTheme(HELLO)
    const css = built.css
    expect(built.files).toEqual(['entry.js', 'theme.css'])
    expect(cssScopeErrors(css, 'hello')).toEqual([])
    expect(css).toMatch(/html\.hello\s*\{\s*--hello-accent/)
    expect(css).toContain('html.hello .hello-bar')
    expect(css).toMatch(/html\.hello \.hello-frame-[A-Za-z0-9_-]+/)
    expect(css).toMatch(/@keyframes hello-spin-[A-Za-z0-9_-]+/)
    expect(css).toContain('@keyframes hello-pulse')
    expect(css).toContain('animation: hello-pulse 2s')
    expect(css).toContain('font-family: hello-Hello-Sans')
  })

  it('wraps in :where() when asked', async () => {
    const css = (await buildTheme(HELLO, { wrap: 'where' })).css
    expect(cssScopeErrors(css, 'hello')).toEqual([])
    expect(css).toContain(':where(html.hello) .hello-bar')
    expect(css).not.toMatch(/(^|[^(])html\.hello \.hello-bar/)
  })

  it('takes htmlClass from the options over theme.json', async () => {
    const css = (await buildTheme({ ...HELLO, 'theme.json': '{}' }, { htmlClass: 'hello' })).css
    expect(css).toContain('html.hello .hello-bar')
  })

  it('refuses a theme that imports sonner', async () => {
    const entry = `import { toast } from 'sonner'\n${ENTRY}\ntoast('hi')\n`
    await expect(buildTheme({ ...HELLO, 'src/entry.js': entry })).rejects.toThrow(/sonner/)
  })

  it('refuses a stylesheet the server would refuse', async () => {
    const css = `${GLOBAL_CSS}.hello-bar { color: red !important; }\n`
    await expect(buildTheme({ ...HELLO, 'src/theme.css': css })).rejects.toThrow(/CSS_IMPORTANT/)
  })

  it('refuses a theme with no htmlClass anywhere', async () => {
    await expect(buildTheme({ ...HELLO, 'theme.json': '{}' })).rejects.toThrow(/htmlClass/)
  })
})

describe('a theme reaching outside its src/', () => {
  const LOGO = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const withEntry = (head: string): string => `${head}\n${ENTRY}`

  it.each<[string, Files]>([
    ['a relative import', { 'outside.js': 'export const secret = 1\n', 'src/entry.js': withEntry("import { secret } from '../outside.js'\nexport { secret }") }],
    ['an import.meta.glob match', { 'looks/a.json': '{"a":1}', 'src/entry.js': withEntry("export const looks = import.meta.glob('../looks/*.json', { eager: true })") }],
    ['a new URL(..., import.meta.url) asset', { 'logo.svg': LOGO, 'src/entry.js': withEntry("export const logo = new URL('../logo.svg', import.meta.url)") }],
    ['a CSS url()', { 'logo.svg': LOGO, 'src/theme.css': `${GLOBAL_CSS}.hello-bar { background: url('../logo.svg'); }\n` }],
    ['a CSS url() in an imported stylesheet', {
      'logo.svg': LOGO,
      'src/parts/more.css': ".hello-more { background: url('../../logo.svg'); }\n",
      'src/theme.css': `@import './parts/more.css';\n${GLOBAL_CSS}`,
    }],
  ])('does not build with %s', async (_name, extra) => {
    await expect(buildTheme({ ...HELLO, ...extra })).rejects.toThrow(/outside the theme's src\//)
  })

  it('does not build with an absolute import', async () => {
    const elsewhere = themeFolder({ 'secret.js': 'export const secret = 1\n' })
    const entry = withEntry(`import { secret } from ${JSON.stringify(join(elsewhere, 'secret.js'))}\nexport { secret }`)
    await expect(buildTheme({ ...HELLO, 'src/entry.js': entry })).rejects.toThrow(/outside the theme's src\//)
  })

  it('builds when globs and assets stay under src/, inlining the asset', async () => {
    const entry = withEntry([
      "export const looks = import.meta.glob('./looks/*.json', { eager: true })",
      "export const logo = new URL('./logo.svg', import.meta.url)",
    ].join('\n'))
    const built = await buildTheme({ ...HELLO, 'src/entry.js': entry, 'src/looks/a.json': '{"a":1}', 'src/logo.svg': LOGO })
    expect(built.files).toEqual(['entry.js', 'theme.css'])
    expect(built.entry).toContain('data:image/svg+xml')
  })
})
