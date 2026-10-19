/**
 * The output check on its own: which data: URLs and emitted assets it lets through, against a theme
 * folder in the system temp directory.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { bundleProblems, dataPayloads, inlinableData, inlinedDataProblems, svgPayload } from '../src/output-check.ts'
import { sourceTree } from '../src/source-tree.ts'

const ROOT = mkdtempSync(join(tmpdir(), 'automatos-output-'))
const SRC = join(ROOT, 'src')
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg">\n  <path d="M0 0h1"/>\n</svg>\n'
const DOT = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
const OUTSIDE = Buffer.from('not a file under src')
mkdirSync(join(SRC, 'img'), { recursive: true })
writeFileSync(join(SRC, 'img', 'logo.svg'), LOGO)
writeFileSync(join(SRC, 'img', 'dot.png'), DOT)
writeFileSync(join(SRC, 'theme.css'), ".a { mask: url('data:image/svg+xml,%3csvg/%3e'); background: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=); }\n")
writeFileSync(join(ROOT, 'outside.png'), OUTSIDE)
const TREE = sourceTree(ROOT)
const INLINABLE = () => inlinableData(TREE)
const NOT_FROM_SRC = /not the content of a file under the theme's src\//

afterAll(() => rmSync(ROOT, { recursive: true, force: true }))

describe('data: URLs', () => {
  it('reads each payload as far as it runs, and skips what only looks like one', () => {
    const text = "a=\"data:image/png;base64,AAAA+/==\";b=url(data:image/svg+xml,%3csvg%20a='1'(2)%3e) c={data:1,x:2}"
    expect(dataPayloads(text)).toEqual([
      { base64: true, text: 'AAAA+/==' },
      { base64: false, text: "%3csvg%20a='1'(2)%3e)" },
    ])
  })

  it("writes an SVG the way Vite does, and leaves the ones Vite base64-encodes", () => {
    expect(svgPayload(Buffer.from(LOGO))).toBe("%3csvg%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M0%200h1'/%3e%3c/svg%3e")
    expect(svgPayload(Buffer.from('<svg><text>x</text></svg>'))).toBeNull()
  })

  it.each([
    ['a file under src/, as base64', `new URL("data:image/png;base64,${DOT.toString('base64')}", import.meta.url)`],
    ['an SVG under src/, as Vite writes it', `new URL("data:image/svg+xml,${svgPayload(Buffer.from(LOGO)) ?? ''}", import.meta.url)`],
    ['a data: URL written in a file under src/, requoted', 'mask:url("data:image/svg+xml,%3csvg/%3e")'],
    ['a base64 data: URL written in a file under src/', "url('data:image/gif;base64,R0lGODlhAQABAAAAACw=')"],
    ['an empty payload', 'x="data:image/png;base64,"+y'],
  ])('lets %s through', (_name, text) => {
    expect(inlinedDataProblems(text, 'entry.js', INLINABLE)).toEqual([])
  })

  it.each([
    ['a file from outside src/, as base64', `"data:image/png;base64,${OUTSIDE.toString('base64')}"`],
    ['an SVG that only starts like one written under src/', '"data:image/svg+xml,%3csvg/%3e%3cpath/%3e"'],
    ['a file from outside src/, in a stylesheet', `url(data:image/png;base64,${OUTSIDE.toString('base64')})`],
  ])('refuses %s', (_name, text) => {
    const problems = inlinedDataProblems(text, 'theme.css', INLINABLE)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(NOT_FROM_SRC)
  })
})

describe('emitted assets', () => {
  const asset = (originalFileNames: string[], source: string | Uint8Array = '') => ({ type: 'asset', originalFileNames, source })

  it('lets an asset made from a file under src/ through, given relative to the root or absolute', () => {
    const bundle = { 'a.png': asset(['src/img/dot.png'], DOT), 'b.png': asset([join(SRC, 'img', 'dot.png')], DOT) }
    expect(bundleProblems(bundle, TREE)).toEqual([])
  })

  it('refuses an asset made from outside src/ or from no file', () => {
    const bundle = { 'a.png': asset([join(ROOT, 'outside.png')], OUTSIDE), 'b.bin': asset([]) }
    const problems = bundleProblems(bundle, TREE)
    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toMatch(/a\.png from .*outside\.png, which is outside[\s\S]*b\.bin, which was not made from a file/)
  })

  it("reads the stylesheet's inlined data: URLs rather than its original file", () => {
    const css = `.a { background: url(data:image/png;base64,${OUTSIDE.toString('base64')}); }`
    const problems = bundleProblems({ 'theme.css': asset(['style.css'], Buffer.from(css)) }, TREE)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(NOT_FROM_SRC)
  })

  it('reads the data: URLs a chunk inlines', () => {
    const code = `export const a = new URL("data:image/png;base64,${OUTSIDE.toString('base64')}", "" + import.meta.url)`
    const bundle = { 'entry.js': { type: 'chunk', moduleIds: [join(SRC, 'entry.ts')], imports: [], dynamicImports: [], code } }
    expect(bundleProblems(bundle, TREE)).toEqual([expect.stringMatching(NOT_FROM_SRC)])
  })
})
