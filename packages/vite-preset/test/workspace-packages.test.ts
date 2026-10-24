/**
 * PRD-261 B-01i: the kit workspace packages a theme bundles, on a kit laid out in the system temp folder
 * (themes/<theme>/ beside packages/<name>/). The theme's package.json names the packages it bundles, and only a kit
 * library (`"kitLibrary": true`) is one; the guard reads their src/ beside the theme's and nothing else of theirs;
 * the preset resolves their names there itself, never through node_modules; and a real Vite build bundles them, or
 * refuses a package that reaches outside its src/.
 */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'
import { automatosTheme, type ThemePresetOptions } from '../src/index.ts'
import { moduleProblem, sourceTree } from '../src/source-tree.ts'
import { bundledPackages, KIT_LIBRARY_FIELD, kitPackageFolder, packageModule } from '../src/workspace-packages.ts'

type Files = Readonly<Record<string, string>>

/** The temp kit, through symlinks (bundledPackages gives each package's folder so). */
const KIT = realpathSync(mkdtempSync(join(tmpdir(), 'automatos-kit-')))
const GREET = join(KIT, 'packages', 'greet')
const GREETING = 'hello from greet'

const manifest = (fields: Readonly<Record<string, unknown>>): string => `${JSON.stringify(fields, null, 2)}\n`
/** A kit library's package.json: a package a theme may bundle. */
const library = (fields: Readonly<Record<string, unknown>>): string => manifest({ ...fields, [KIT_LIBRARY_FIELD]: true })

/** Writes `files` under the kit, by kit-relative path. */
function write(files: Files): void {
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(KIT, path)), { recursive: true })
    writeFileSync(join(KIT, path), text)
  })
}

write({
  'packages/greet/package.json': library({ name: '@automatos/greet', version: '0.1.0' }),
  'packages/greet/src/index.ts': "export const mark: string = '!'\n",
  'packages/greet/src/words.ts': `export function greet(): string {\n  return '${GREETING}'\n}\n`,
  'packages/greet/secret.ts': "export const secret = 'beside src/'\n",
  'packages/leaky/package.json': library({ name: '@automatos/leaky', version: '0.1.0' }),
  'packages/leaky/src/index.ts': "export { secret } from '../secret.ts'\n",
  'packages/leaky/secret.ts': "export const secret = 'beside src/'\n",
  'packages/tool/package.json': manifest({ name: '@automatos/tool', version: '0.1.0', exports: { '.': './src/index.ts' } }),
  'packages/tool/src/index.ts': "export const tool = 'a build tool'\n",
  'packages/effects/package.json': library({ name: '@automatos/effects', version: '0.1.0', sideEffects: false }),
  'packages/effects/src/index.ts': 'export const effects = 1\n',
  // The SDK as the kit vendors it: no kit library, and it sets sideEffects.
  'packages/theme-sdk/package.json': manifest({ name: '@automatos/theme-sdk', version: '1.1.0', sideEffects: false }),
})

/** A theme folder in the kit's themes/, bundling `dependencies`, with `entry` as src/entry.js. */
function theme(name: string, entry: string, dependencies: Readonly<Record<string, string>> | null): string {
  const files: Record<string, string> = {
    [`themes/${name}/theme.json`]: manifest({ htmlClass: 'hello' }),
    [`themes/${name}/src/entry.js`]: entry,
  }
  if (dependencies !== null) {
    files[`themes/${name}/package.json`] = manifest({ name: `@automatos/theme-${name}`, version: '1.0.0', dependencies, devDependencies: { '@automatos/tool': '0.1.0' } })
  }
  write(files)
  return join(KIT, 'themes', name)
}

const GREET_ENTRY = "import { mark } from '@automatos/greet'\nimport { greet } from '@automatos/greet/words'\nexport const hello = greet() + mark\n"
const HELLO = theme('hello', GREET_ENTRY, { '@automatos/greet': '0.1.0', '@automatos/absent': '0.1.0', 'left-pad': '1.3.0' })

/** The theme built with the preset into its dist/; dist/entry.js as text. */
async function built(root: string, options: ThemePresetOptions = {}): Promise<string> {
  await build({ root, configFile: false, logLevel: 'silent', plugins: [automatosTheme({ entry: 'src/entry.js', ...options })] })
  return readFileSync(join(root, 'dist', 'entry.js'), 'utf8')
}

afterAll(() => rmSync(KIT, { recursive: true, force: true }))

describe('the packages a theme bundles', () => {
  it('are the kit packages its package.json names under dependencies, at their versions, and nothing else', () => {
    expect(bundledPackages(HELLO)).toEqual([{ name: '@automatos/greet', dir: GREET }])
    expect(bundledPackages(theme('alone', 'export {}\n', null))).toEqual([])
    const folders = ['@automatos/look-kit', '@automatos/mascot', 'left-pad', '@other/look-kit', '@automatos/../x', '@automatos/Up']
    expect(folders.map(kitPackageFolder)).toEqual(['look-kit', 'mascot', null, null, null, null])
  })

  it('refuse a version the kit package is not at, and a bundled package that sets sideEffects', () => {
    expect(() => bundledPackages(theme('wrong', 'export {}\n', { '@automatos/greet': '0.2.0' }))).toThrow(/0\.2\.0[\s\S]*0\.1\.0/)
    expect(bundledPackages(theme('any', 'export {}\n', { '@automatos/greet': '*' }))).toEqual([{ name: '@automatos/greet', dir: GREET }])
    expect(() => bundledPackages(theme('effects', 'export {}\n', { '@automatos/effects': '0.1.0' }))).toThrow(/sideEffects/)
  })

  it('leave out a kit package that is no kit library, such as the SDK the host serves or a build tool', () => {
    const tools = theme('tools', 'export {}\n', { '@automatos/theme-sdk': '1.1.0', '@automatos/tool': '0.1.0', '@automatos/greet': '0.1.0' })
    expect(bundledPackages(tools)).toEqual([{ name: '@automatos/greet', dir: GREET }])
    const tree = sourceTree(tools, bundledPackages(tools))
    expect(moduleProblem(join(KIT, 'packages', 'tool', 'src', 'index.ts'), tree)).toMatch(/outside the theme's src\//)
  })

  it("resolve by name to a file of the package's src/, or say why the name is none of its modules", () => {
    const packages = bundledPackages(HELLO)
    expect(packageModule('@automatos/greet', packages)).toEqual({ file: join(GREET, 'src', 'index.ts') })
    expect(packageModule('@automatos/greet/words', packages)).toEqual({ file: join(GREET, 'src', 'words.ts') })
    expect(packageModule('@automatos/greet/words?raw', packages)).toEqual({ file: `${join(GREET, 'src', 'words.ts')}?raw` })
    expect(packageModule('@automatos/greet/nope', packages)).toEqual({ problem: expect.stringContaining('names no module of @automatos/greet') })
    expect(packageModule('@automatos/greet/../secret', packages)).toEqual({ problem: expect.stringContaining('without its extension') })
    expect(['react', '@automatos/greeting', './words'].map((specifier) => packageModule(specifier, packages))).toEqual([null, null, null])
  })

  it("let the guard read their src/, and nothing else of theirs or of a kit package the theme doesn't name", () => {
    const tree = sourceTree(HELLO, bundledPackages(HELLO))
    expect(moduleProblem(join(GREET, 'src', 'words.ts'), tree)).toBeNull()
    expect(moduleProblem(join(GREET, 'secret.ts'), tree)).toMatch(/packages\/greet\/secret\.ts, which is outside the theme's src\//)
    expect(moduleProblem(join(KIT, 'packages', 'tool', 'src', 'index.ts'), tree)).toMatch(/outside the theme's src\//)
  })
})

describe('a theme built with the packages it bundles', () => {
  it("bundles the package's modules into dist/entry.js", async () => {
    const code = await built(HELLO)
    expect(code).toContain(GREETING)
    expect(code).not.toMatch(/from\s*["']@automatos\/greet/)
  })

  it('builds when the theme names the SDK under dependencies, and keeps the SDK external', async () => {
    const entry = "import { defineTheme } from '@automatos/theme-sdk'\nexport const define = defineTheme\n"
    const code = await built(theme('sdk', entry, { '@automatos/theme-sdk': '1.1.0' }))
    expect(code).toMatch(/from\s*["']@automatos\/theme-sdk["']/)
  })

  it('builds with the packages it is given, as the review rebuilds a folder with no package.json', async () => {
    const code = await built(theme('rebuilt', GREET_ENTRY, null), { packages: [{ name: '@automatos/greet', dir: GREET }] })
    expect(code).toContain(GREETING)
  })

  it("does not build when a bundled package's module reaches outside its src/", async () => {
    const leaky = theme('leaky', "export { secret } from '@automatos/leaky'\n", { '@automatos/leaky': '0.1.0' })
    await expect(built(leaky)).rejects.toThrow(/packages\/leaky\/secret\.ts, which is outside the theme's src\//)
  })

  it("does not bundle a kit package the theme doesn't name, even through a node_modules link to it", async () => {
    const unnamed = theme('unnamed', "export { tool } from '@automatos/tool'\n", {})
    mkdirSync(join(unnamed, 'node_modules', '@automatos'), { recursive: true })
    symlinkSync(join(KIT, 'packages', 'tool'), join(unnamed, 'node_modules', '@automatos', 'tool'))
    await expect(built(unnamed)).rejects.toThrow(/packages\/tool\/src\/index\.ts, which is outside the theme's src\//)
  })
})
