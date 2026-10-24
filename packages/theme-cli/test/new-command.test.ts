/**
 * `automatos-theme new` (PRD-261 B-03f): the arguments it takes, the themes it refuses before it writes anything (a
 * folder that is there already, one inside the kit's own folders, Automatos's own publisher, a class core keeps on
 * <html>, a name that can't be a class), and the minimal template written with its placeholders filled. The full
 * template's real builds are the kit's tests/template-full.test.ts; the minimal one's is tests/template-minimal.test.ts.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMANDS, run, type CommandDeps } from '../src/cli-main.ts'
import { KIT_FOLDERS_KEPT, KIT_ROOT, NEW_USAGE, parseNew, runNew } from '../src/new/index.ts'
import { placeholdersIn, readFolder, themeNames } from '../src/new/placeholders.ts'
import { BASE_TSCONFIG, standaloneTsconfig } from '../src/new/tsconfig.ts'

const folders: string[] = []

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }))
})

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'automatos-new-'))
  folders.push(folder)
  return folder
}

interface Ran {
  readonly code: number
  readonly out: readonly string[]
  readonly err: readonly string[]
}

function ranNew(argv: readonly string[], cwd: string): Ran {
  const out: string[] = []
  const err: string[] = []
  const code = runNew(argv, { out: (line) => out.push(line), err: (line) => err.push(line) }, cwd)
  return { code, out, err }
}

describe('the arguments', () => {
  it.each([
    [[]],
    [['new']],
    [['new', 'acme/sample']],
    [['new', 'acme/sample', '--template', 'big']],
    [['new', 'acme/sample', 'extra', '--template', 'minimal']],
    [['new', 'acme/sample', '--template', 'minimal', '--mascot', 'none']],
    [['new', 'acme/sample', '--template', 'full', '--mascot', 'clips']],
    [['new', 'acme/sample', '--template', 'full', '--colour', 'red']],
  ])('%j is a usage error: the usage, exit 2, nothing written', (argv) => {
    const cwd = tempFolder()
    expect(ranNew(argv, cwd)).toEqual({ code: 2, out: [], err: [NEW_USAGE] })
    expect(readdirSync(cwd)).toEqual([])
  })

  it('writes to themes/<name> in the folder it runs in unless --to says where', () => {
    const cwd = tempFolder()
    expect(parseNew(['new', 'acme/sample', '--template', 'minimal'], cwd)?.target).toBe(join(cwd, 'themes', 'sample'))
    expect(parseNew(['new', 'acme/sample', '--template', 'full', '--to', 'x/y'], cwd)).toEqual({
      id: 'acme/sample', template: 'full', mascot: true, target: join(cwd, 'x', 'y'),
    })
    expect(parseNew(['new', 'acme/sample', '--template', 'full', '--mascot', 'none'], cwd)?.mascot).toBe(false)
  })
})

describe('the themes new refuses, writing nothing', () => {
  it.each([
    ['automatos/sample', 'The publisher "automatos" is reserved'],
    ['acme/studio', '"studio" is a class core keeps on <html>'],
    ['acme/dark', '"dark" is a class core keeps on <html>'],
    ['acme/system', '"system" is a class core keeps on <html>'],
    ['acme/ab', '"ab" can\'t be the theme\'s name'],
    ['acme/2fast', '"2fast" can\'t be the theme\'s name'],
    ['acme/two--dashes', '"two--dashes" can\'t be the theme\'s name'],
    ['Acme/sample', '"Acme/sample" is not a theme id'],
    ['sample', '"sample" is not a theme id'],
  ])('%s', (id, reason) => {
    const cwd = tempFolder()
    const ran = ranNew(['new', id, '--template', 'minimal', '--to', 'theme'], cwd)
    expect(ran.code).toBe(1)
    expect(ran.err[0]).toBe(`automatos-theme new ${id}: nothing was written.`)
    expect(ran.err.slice(1).join('\n')).toContain(reason)
    expect(existsSync(join(cwd, 'theme'))).toBe(false)
  })

  it('a folder that is there already, which it leaves as it was', () => {
    const cwd = tempFolder()
    mkdirSync(join(cwd, 'themes', 'sample'), { recursive: true })
    const ran = ranNew(['new', 'acme/sample', '--template', 'full'], cwd)
    expect(ran.code).toBe(1)
    expect(ran.err.join('\n')).toContain('new never writes over a folder')
    expect(readdirSync(join(cwd, 'themes', 'sample'))).toEqual([])
  })

  it.each(KIT_FOLDERS_KEPT)("a folder inside the kit's %s, which new only reads", (folder) => {
    const target = join(KIT_ROOT, folder, 'automatos-new-refused')
    const ran = ranNew(['new', 'acme/sample', '--template', 'minimal', '--to', target], tempFolder())
    expect([ran.code, ran.err.slice(1)]).toEqual([1, [`  ${target} is inside the kit's ${folder}/, which new only reads: pick a --to outside it.`]])
    expect(existsSync(target)).toBe(false)
  })
})

describe('new --template minimal', () => {
  it("writes every file of the template, the theme's names filled in, and says what to do next", () => {
    const cwd = tempFolder()
    const ran = ranNew(['new', 'acme/night-owl', '--template', 'minimal', '--to', 'owl'], cwd)
    const target = join(cwd, 'owl')
    expect(ran.code).toBe(0)
    expect(ran.out[0]).toMatch(/: acme\/night-owl from the minimal template, \d+ files\.$/)
    const written = readFolder(target)
    expect(written.map((file) => file.path)).toEqual(readFolder(join(KIT_ROOT, 'templates', 'minimal')).map((file) => file.path))
    expect(written.filter((file) => placeholdersIn(new TextDecoder().decode(file.data)).length > 0)).toEqual([])
    const manifest = JSON.parse(readFileSync(join(target, 'theme.json'), 'utf8')) as Record<string, unknown>
    expect([manifest.id, manifest.name, manifest.htmlClass]).toEqual(['acme/night-owl', 'Night Owl', 'night-owl'])
    expect(readFileSync(join(target, 'src', 'app', 'theme.css'), 'utf8')).toContain('--night-owl-accent-text')
  })

  it("writes a tsconfig.json that holds the kit's compiler options itself, so the theme builds outside the kit", () => {
    const cwd = tempFolder()
    expect(ranNew(['new', 'acme/night-owl', '--template', 'minimal', '--to', 'owl'], cwd).code).toBe(0)
    const written = JSON.parse(readFileSync(join(cwd, 'owl', 'tsconfig.json'), 'utf8')) as Record<string, unknown>
    const base = JSON.parse(readFileSync(join(KIT_ROOT, BASE_TSCONFIG), 'utf8')) as Record<string, unknown>
    const template = JSON.parse(readFileSync(join(KIT_ROOT, 'templates', 'minimal', 'tsconfig.json'), 'utf8')) as Record<string, unknown>
    expect(written).toEqual({ compilerOptions: base.compilerOptions, include: template.include })
  })

  it("lets the theme's own compiler options win over the kit's, and drops the extends", () => {
    const base = { compilerOptions: { strict: true, jsx: 'react-jsx' } }
    const theme = { extends: '../../tsconfig.base.json', compilerOptions: { jsx: 'preserve' }, include: ['src'] }
    expect(standaloneTsconfig(theme, base)).toEqual({ compilerOptions: { strict: true, jsx: 'preserve' }, include: ['src'] })
  })

  it("runs through the command table's row", async () => {
    const cwd = tempFolder()
    const deps: CommandDeps = { env: {}, fetch: globalThis.fetch, cwd }
    const silent = { out: () => undefined, err: () => undefined }
    expect(COMMANDS.find((command) => command.name === 'new')?.module).toBe('./new/index.ts')
    await expect(run(['new', 'acme/sample', '--template', 'minimal'], silent, deps)).resolves.toBe(0)
    expect(existsSync(join(cwd, 'themes', 'sample', 'theme.json'))).toBe(true)
  })
})

describe("a theme's names", () => {
  it('come from its id: a display name, a class, and the forms code names take', () => {
    expect(themeNames('acme/night-owl')).toEqual({
      id: 'acme/night-owl', publisher: 'acme', slug: 'night-owl', name: 'Night Owl', htmlClass: 'night-owl',
      pascal: 'NightOwl', constant: 'NIGHT_OWL', camel: 'nightOwl',
    })
  })
})
