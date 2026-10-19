/**
 * The CSS origin check on its own: a stylesheet whose nodes or reported dependencies come from
 * outside the theme's src/ is refused, whatever the @import that brought them in looked like.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postcss from 'postcss'
import { afterAll, describe, expect, it } from 'vitest'
import { cssOriginProblems } from '../src/css-origin.ts'
import { sourceTree } from '../src/source-tree.ts'

const ROOT = mkdtempSync(join(tmpdir(), 'automatos-css-origin-'))
const SRC = join(ROOT, 'src')
mkdirSync(join(SRC, 'parts'), { recursive: true })
const TREE = sourceTree(ROOT)
const OUTSIDE = join(ROOT, 'outside.css')

afterAll(() => rmSync(ROOT, { recursive: true, force: true }))

const parsed = (css: string, from?: string) => postcss.parse(css, from === undefined ? {} : { from })

describe('the CSS origin check', () => {
  it('lets CSS from files under src/, and nodes a plugin made, through', () => {
    const root = parsed('.hello-a {}', join(SRC, 'theme.css'))
    root.append(parsed('.hello-b {}', join(SRC, 'parts', 'more.css')))
    root.append(parsed('.hello-c {}'))
    const messages = [{ type: 'dependency', plugin: 'postcss-import', file: join(SRC, 'parts', 'more.css') }]
    expect(cssOriginProblems(root, messages, TREE)).toEqual([])
  })

  it('refuses a node from a file outside src/', () => {
    const root = parsed('.hello-a {}', join(SRC, 'theme.css'))
    root.append(parsed('.hello-leak {}', OUTSIDE))
    expect(cssOriginProblems(root, [], TREE)).toEqual([expect.stringMatching(/outside\.css, which is outside the theme's src\//)])
  })

  it('refuses a reported dependency outside src/', () => {
    const root = parsed('.hello-a {}', join(SRC, 'theme.css'))
    const messages = [{ type: 'dependency', plugin: 'postcss-import', file: OUTSIDE }, { type: 'dir-dependency', dir: ROOT }]
    expect(cssOriginProblems(root, messages, TREE)).toHaveLength(2)
  })
})
