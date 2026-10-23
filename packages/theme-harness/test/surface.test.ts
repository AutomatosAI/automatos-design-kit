// @vitest-environment node
// PRD-261 B-02b: the fake SDK's runtime names are exactly the vendored SDK's value exports
// (packages/theme-sdk: every area index.d.ts re-exports), nothing missing and nothing extra, so a name added
// to the vendored types fails here until the harness fakes it. A static read of the declarations.
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as fake from '../src/sdk/index.ts'

const SDK_ROOT = dirname(createRequire(import.meta.url).resolve('@automatos/theme-sdk/package.json'))
const AREAS = join(SDK_ROOT, 'areas')
/** index.d.ts's re-export of one area. */
const AREA_EXPORT = /^export \* from '\.\/areas\/([\w-]+)'$/gm
/** A declared value: a function (each overload once), a constant, a class, an enum or a namespace. */
const VALUE_EXPORT = /^export declare (?:function|const|let|var|class|enum|namespace) (\w+)/gm
/** Any export that names values another way: a list with names in it, or a default. */
const OTHER_VALUE_EXPORT = /^export (?:\{\s*\w|default\b)/m
const DECLARATION = '.d.ts'

function readSdk(rel: string): string {
  return readFileSync(join(SDK_ROOT, rel), 'utf8')
}

/** The areas index.d.ts re-exports, in its order. */
function reExportedAreas(): string[] {
  return Array.from(readSdk('index.d.ts').matchAll(AREA_EXPORT), (match) => match[1])
}

/** One area's declared value names, once each. */
function valueNames(area: string): string[] {
  const text = readSdk(`areas/${area}${DECLARATION}`)
  return Array.from(new Set(Array.from(text.matchAll(VALUE_EXPORT), (match) => match[1])))
}

describe('the vendored SDK, as the surface reads it', () => {
  it('re-exports every area file, and each area declares its values in the one form read here', () => {
    const files = readdirSync(AREAS).filter((name) => name.endsWith(DECLARATION)).map((name) => name.slice(0, -DECLARATION.length))
    expect([...reExportedAreas()].sort()).toEqual(files.sort())
    expect(files.filter((area) => OTHER_VALUE_EXPORT.test(readSdk(`areas/${area}${DECLARATION}`)))).toEqual([])
    expect(files.every((area) => valueNames(area).length > 0)).toBe(true)
  })

  it('reads the forms it counts: overloads once, constants, and nothing from an empty export list', () => {
    const sample = ['export declare function a(x: 1): 1', 'export declare function a(): 2', 'export declare const B: string', 'export {}'].join('\n')
    expect(Array.from(new Set(Array.from(sample.matchAll(VALUE_EXPORT), (match) => match[1])))).toEqual(['a', 'B'])
    expect(OTHER_VALUE_EXPORT.test('export {}')).toBe(false)
    expect(OTHER_VALUE_EXPORT.test('export { a }')).toBe(true)
  })
})

describe("the harness's fake SDK", () => {
  const declared = reExportedAreas().flatMap(valueNames)

  it('exports every value name the vendored SDK declares, and nothing else', () => {
    expect(new Set(declared).size).toBe(declared.length)
    expect(Object.keys(fake).sort()).toEqual([...declared].sort())
  })

  it('gives every name a value', () => {
    const fakes = new Map<string, unknown>(Object.entries(fake))
    expect(declared.filter((name) => fakes.get(name) === undefined || fakes.get(name) === null)).toEqual([])
  })
})
