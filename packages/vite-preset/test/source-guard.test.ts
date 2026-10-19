/**
 * The source guard's rules on their own: which module ids, file references and output chunks it
 * lets through, against a theme folder in the system temp directory.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { bundleProblems } from '../src/output-check.ts'
import {
  isInsideSource,
  moduleProblem,
  referenceProblem,
  scriptReferences,
  sourceTree,
  styleReferences,
  transformProblems,
} from '../src/source-guard.ts'

const ROOT = mkdtempSync(join(tmpdir(), 'automatos-guard-'))
const SRC = join(ROOT, 'src')
mkdirSync(join(SRC, 'parts'), { recursive: true })
writeFileSync(join(SRC, 'entry.ts'), '')
writeFileSync(join(SRC, 'parts', 'more.css'), ".a { background: url('../../theme.json'); }\n")
writeFileSync(join(ROOT, 'theme.json'), '{}')
symlinkSync(ROOT, join(SRC, 'up'))
const TREE = sourceTree(ROOT)
const ENTRY = join(SRC, 'entry.ts')

afterAll(() => rmSync(ROOT, { recursive: true, force: true }))

describe('modules', () => {
  it.each([
    ['a virtual id', '\0vite/preload-helper.js'],
    ['a shared module', 'react/jsx-runtime'],
    ['a file under src/', ENTRY],
    ['a file under src/ with a query', `${join(SRC, 'logo.svg')}?url`],
  ])('lets %s through', (_name, id) => {
    expect(moduleProblem(id, TREE)).toBeNull()
  })

  it.each([
    ['a file beside src/', join(ROOT, 'theme.json')],
    ['a file in node_modules', join(ROOT, '..', 'node_modules', 'left-pad', 'index.js')],
    ['a browser external', '__vite-browser-external:fs'],
    ['src/ itself', SRC],
    ['a symlink out of src/', join(SRC, 'up', 'theme.json')],
  ])('refuses %s', (_name, id) => {
    expect(moduleProblem(id, TREE)).toMatch(/src\//)
  })

  it('names the file relative to the theme root', () => {
    expect(moduleProblem(join(ROOT, 'theme.json'), TREE)).toContain('theme.json, which is outside')
    expect(isInsideSource(join(SRC, 'parts', '..', 'entry.ts'), TREE)).toBe(true)
  })
})

describe('file references', () => {
  it.each(['./logo.svg', './parts/x.png?url', 'data:image/png;base64,AAAA', 'https://example.com/a.png', '#mask', '`./looks/${name}.svg`', ''])(
    'lets %j through',
    (ref) => expect(referenceProblem(ref, ENTRY, TREE)).toBeNull(),
  )

  it.each([
    ['../theme.json', /outside the theme's src/],
    ['./up/theme.json', /outside the theme's src/],
    ['/etc/hosts', /absolute path/],
    ['file:///etc/hosts', /absolute path/],
    ['C:\\secrets.txt', /absolute path/],
    ['logo.svg', /relative path \(\.\/ or \.\.\/\)/],
    ['left-pad/logo.svg', /relative path/],
  ])('refuses %j', (ref, message) => {
    expect(referenceProblem(ref, ENTRY, TREE)).toMatch(message)
  })

  it('reads new URL(..., import.meta.url) the way Vite does', () => {
    const code = "const a = new URL('./a.svg', import.meta.url)\nconst b = new URL(\n  \"../b.png\" , import.meta.url, )\nconst c = new URL(`./c/${n}.svg`, import.meta.url)"
    expect(scriptReferences(code)).toEqual(['./a.svg', '../b.png', '`./c/${n}.svg`'])
    expect(transformProblems(code, ENTRY, TREE)).toHaveLength(1)
  })

  it('reads url(), image-set(), @import and composes from a stylesheet', () => {
    const css = [
      "@import './parts/more.css';",
      '.a { background: url(./a.png) , url("b.png"); mask: url(#m); }',
      ".b { background-image: image-set('./c.png' 1x, \"../d.png\" 2x); }",
      ".c { composes: base from '../shared.css'; }",
    ].join('\n')
    expect(styleReferences(css)).toEqual({
      imports: ['./parts/more.css', '../shared.css'],
      assets: ['./a.png', 'b.png', '#m', './c.png', '../d.png'],
    })
  })

  it('follows a stylesheet import and checks its references too', () => {
    const problems = transformProblems("@import './parts/more.css';\n", join(SRC, 'theme.css'), TREE)
    expect(problems).toEqual([expect.stringMatching(/src\/parts\/more\.css refers to "\.\.\/\.\.\/theme\.json", which is outside/)])
  })

  it('leaves other files alone', () => {
    expect(transformProblems("new URL('/etc/hosts', import.meta.url)", join(SRC, 'data.json'), TREE)).toEqual([])
  })
})

describe('the output', () => {
  const chunk = (moduleIds: string[], imports: string[] = [], dynamicImports: string[] = []) => ({ type: 'chunk', moduleIds, imports, dynamicImports })

  it('lets src/ modules, shared imports and own chunks through', () => {
    const bundle = {
      'entry.js': chunk([ENTRY, '\0rolldown/runtime.js'], ['react', 'chunks/c-1.js'], ['chunks/c-1.js']),
      'chunks/c-1.js': chunk([join(SRC, 'lazy.ts')]),
      'theme.css': { type: 'asset' },
    }
    expect(bundleProblems(bundle, TREE)).toEqual([])
  })

  it('refuses a module from outside src/ and a run-time import the host does not serve', () => {
    const bundle = { 'entry.js': chunk([ENTRY, join(ROOT, 'theme.json')], ['lodash'], ['https://evil.example/x.js']) }
    const problems = bundleProblems(bundle, TREE)
    expect(problems).toHaveLength(3)
    expect(problems.join('\n')).toMatch(/lodash[\s\S]*evil\.example/)
  })
})
