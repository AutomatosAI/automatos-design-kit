// @vitest-environment node
// PRD-261 B-01i: src/plain-line.ts, the one other core file the look runtime reads (validate.ts's UNSAFE_TEXT), is
// core's frontend/lib/text/plain-line.ts byte for byte, as the copy Play keeps for its own tests is (Play's
// test/fixtures/core/copied-values.json holds the same sha256, read at core's 101a0bf33).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { oneLine, UNSAFE_TEXT } from '../src/plain-line.ts'

const CORE_PATH = 'frontend/lib/text/plain-line.ts'
const CORE_SHA256 = 'b91b913f53d6b40178063e17f61dcfbcbb144daf03c3f64a659988551ef7a79b'
const COPY = new URL('../src/plain-line.ts', import.meta.url)

describe("the look runtime's copy of core's plain-line.ts", () => {
  it(`is ${CORE_PATH} byte for byte`, () => {
    const sha256 = createHash('sha256').update(readFileSync(COPY)).digest('hex')
    expect({ file: CORE_PATH, sha256 }).toEqual({ file: CORE_PATH, sha256: CORE_SHA256 })
  })

  it('refuses a hidden character in a one-line name and folds a run of them into one space', () => {
    expect(UNSAFE_TEXT.test('a\u200Bb')).toBe(true)
    expect(UNSAFE_TEXT.test('a\u200Db')).toBe(false)
    expect(oneLine('  a\u202E\u00ADb\nc  ')).toBe('a b c')
  })
})
