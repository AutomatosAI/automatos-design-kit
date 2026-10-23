// @vitest-environment node
// PRD-261 B-02f: the shots' plan (src/host/router.ts). Each view gets a file name of its own, for every slot and page
// core knows and for routes that differ only by '/' and '-'; the files a shot group must hold come from theme.json,
// less what the page reports missing; and the presets go default look first, the rest in file-name order, with the
// shots refusing a folder that lacks the default look theme.json names.
import { KNOWN_SLOTS, PAGE_SCOPE } from '@automatos/theme-cli/manifest'
import { describe, expect, it } from 'vitest'
import { declaredIn, EMPTY_SERVED, expectedShots, presetOrder, shotPresets, viewsOf, viewSlug, type Served } from '../src/host/router.ts'

describe('the shots file names', () => {
  it('give every slot and page core knows, and routes that differ only by / and -, a file of their own', () => {
    const slugs = viewsOf({ slots: [...KNOWN_SLOTS], pages: [...PAGE_SCOPE], routes: ['a/b', 'a-b'] }).map((view) => viewSlug(view))
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs.filter((slug) => slug.startsWith('route-'))).toEqual(['route-a_b', 'route-a-b'])
    expect(slugs).toEqual(expect.arrayContaining(['slot-frame-1', 'slot-page-header-mascot-1', 'page-root', 'page-missions-id']))
  })

  it("expects one PNG per view theme.json declares, less what the page reports the theme didn't register", () => {
    const declared = declaredIn({ name: 'Sample', slots: ['frame@1', 'asleep@1'], pages: { '/chat': { mode: 'own' } }, routes: ['notes', 'a/b'] })
    expect(declared).toEqual({ slots: ['frame@1', 'asleep@1'], pages: ['/chat'], routes: ['notes', 'a/b'] })
    const missing: Served = { slots: ['asleep@1'], pages: [], routes: ['notes'] }
    expect(expectedShots(declared, missing)).toEqual(['slot-frame-1.png', 'page-chat.png', 'route-a_b.png'])
    expect(expectedShots(declared, EMPTY_SERVED)).toHaveLength(5)
  })

  it('reads no view from a theme.json without the lists', () => {
    expect(declaredIn(null)).toEqual(EMPTY_SERVED)
    expect(declaredIn({ slots: 'frame@1', pages: ['/chat'], routes: [1] })).toEqual(EMPTY_SERVED)
  })
})

describe('the presets in order', () => {
  it('go default look first, the rest in file-name order', () => {
    expect(presetOrder(['b', 'a', 'dflt'], 'dflt')).toEqual(['dflt', 'a', 'b'])
    // 'a-b.look.json' sorts before 'a.look.json': '-' comes before '.'.
    expect(presetOrder(['a', 'a-b'], undefined)).toEqual(['a-b', 'a'])
    expect(presetOrder(['b', 'a'], 'gone')).toEqual(['a', 'b'])
  })

  it('are refused by the shots when the folder lacks the default look theme.json names', () => {
    expect(() => shotPresets([], 'ember')).toThrow('looks/presets has no ember.look.json')
    expect(shotPresets(['workshop', 'ember', 'aurora'], 'ember')).toEqual(['ember', 'aurora', 'workshop'])
    expect(shotPresets([], undefined)).toEqual([])
  })
})
