/**
 * The `clonedFrom` check gives core's answers: the clone cases of core's
 * orchestrator/tests/test_prd261_review_stage.py at the commit src/core/README.md names, against the
 * vendored data/core-pages.json, on the hello package changed the same way, through the whole review.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cloneCheck, CORE_PAGES_FILE, corePageHashes, describeClones, staleClones, STALE_CLONES } from '../src/check/drift.ts'
import { reviewHello } from './check-support.ts'

const CHAT_PAGE = 'app/chat/page.tsx'
const ZERO_SHA = '0'.repeat(64)

function clonePage(sha: string): Readonly<Record<string, unknown>> {
  return { '/chat': { mode: 'clone', clonedFrom: { path: CHAT_PAGE, sha } } }
}

describe("core's clone cases", () => {
  it('a clone of a core page this host changed is a warning at clonedFrom', async () => {
    const { report } = await reviewHello({ manifest: { pages: clonePage(ZERO_SHA) } })
    const cloned = report.checks.clonedFrom
    expect(report.verdict).toBe('review_required')
    expect(cloned.level).toBe('warning')
    expect(cloned.clones).toEqual(['/chat'])
    expect(cloned.stale).toEqual([{ route: '/chat', path: CHAT_PAGE, sha: ZERO_SHA, releaseSha: corePageHashes().get(CHAT_PAGE) }])
    expect(cloned.reason).toBe(STALE_CLONES.replace('{count}', '1'))
  })

  it('a clone of the current core page passes', async () => {
    const fresh = corePageHashes().get(CHAT_PAGE) as string
    const cloned = (await reviewHello({ manifest: { pages: clonePage(fresh) } })).report.checks.clonedFrom
    expect([cloned.level, cloned.stale, cloned.clones]).toEqual(['pass', [], ['/chat']])
    expect(cloned.reason).toBeNull()
  })
})

describe('the release hashes', () => {
  it("are the vendored core-pages.json's files table, the chat page among them", () => {
    const document = JSON.parse(readFileSync(CORE_PAGES_FILE, 'utf8')) as { files: Record<string, string> }
    expect(Object.fromEntries(corePageHashes())).toEqual(document.files)
    expect(corePageHashes().get(CHAT_PAGE)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('a path the release no longer ships is stale too, with no release hash', () => {
    const release = new Map([['app/page.tsx', ZERO_SHA]])
    expect(staleClones({ pages: clonePage(ZERO_SHA) }, release)).toEqual([
      { route: '/chat', path: CHAT_PAGE, sha: ZERO_SHA, releaseSha: null },
    ])
  })

  it('an owned page is never a clone', () => {
    const entry = cloneCheck({ pages: { '/chat': { mode: 'own' } } }, new Map())
    expect(entry).toMatchObject({ level: 'pass', clones: [], stale: [], reason: null })
    expect(describeClones(entry)).toEqual({ text: 'No cloned pages.', items: [] })
  })

  it('the line names each stale clone and its hashes', () => {
    const entry = cloneCheck({ pages: clonePage(ZERO_SHA) }, new Map([[CHAT_PAGE, 'f'.repeat(64)]]))
    expect(describeClones(entry).items).toEqual([`/chat: ${CHAT_PAGE} is ${'f'.repeat(64)} in this release, not ${ZERO_SHA}`])
  })
})
