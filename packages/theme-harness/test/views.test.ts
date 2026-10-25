// @vitest-environment node
// PRD-261 B-02e/B-02f: the harness's views and the shots' plan (src/host/router.ts). Each view keeps a path of its
// own, frame@1's too when the theme owns the home page; each gets a file name of its own, for every slot and page
// core knows and for routes that differ only by '/' and '-'; the files a shot group must hold come from theme.json,
// less what the page reports missing; and the presets go default look first, the rest in file-name order, with the
// shots refusing a folder that lacks the default look theme.json names. A theme with a /chat page gets two groups more
// (src/host/shot-groups.ts): the chat page with motion allowed, so the Pause Auto control reduced motion hides is shot,
// and on the transcript (test/transcript.test.tsx holds that one).
import { KNOWN_SLOTS, PAGE_SCOPE } from '@automatos/theme-cli/manifest'
import { describe, expect, it } from 'vitest'
import {
  declaredIn, EMPTY_SERVED, expectedShots, HOME_PATH, presetOrder, readSettings, shotPresets, SLOT_PREFIX, viewOfPath, viewsOf, viewSlug,
  type Served,
} from '../src/host/router.ts'
import { groupShots, groupViews, shotAddress, shotGroups } from '../src/host/shot-groups.ts'

const OWNS_HOME: Served = Object.freeze({ slots: ['frame@1', 'lookEditor@1'], pages: ['/', '/chat'], routes: ['notes'] })

describe('a theme that owns the home page', () => {
  it("has frame@1's own view on a path of its own, so every view has one path and each path shows its view", () => {
    const views = viewsOf(OWNS_HOME)
    const paths = views.map((view) => view.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(views[0]).toEqual({ kind: 'slot', key: 'frame@1', path: `${SLOT_PREFIX}frame@1` })
    views.forEach((view) => expect(viewOfPath(view.path, OWNS_HOME)).toEqual(view))
    expect(viewOfPath(HOME_PATH, OWNS_HOME)).toEqual({ kind: 'page', key: '/', path: HOME_PATH })
  })

  it('keeps frame@1 on the home page for a theme that does not own it', () => {
    expect(viewsOf({ ...OWNS_HOME, pages: ['/chat'] })[0]).toEqual({ kind: 'slot', key: 'frame@1', path: HOME_PATH })
  })
})

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

describe('the motion group', () => {
  const declared: Served = { slots: ['frame@1', 'lookEditor@1'], pages: ['/chat', '/deliverables'], routes: ['notes'] }
  const groups = shotGroups(['ember', 'aurora'], 1024, declared.pages)
  const motion = groups.find((group) => !group.reducedMotion)

  it('shoots the chat page once more, in the default look at 1440 px, with motion allowed', () => {
    expect(motion).toEqual({ folder: 'ember/1440-motion', preset: 'ember', width: 1440, reducedMotion: false, page: '/chat', transcript: false })
    expect(groups.slice(0, -2).every((group) => group.reducedMotion && group.page === null && !group.transcript)).toBe(true)
    expect(groups.slice(-2).map((group) => group.folder)).toEqual(['ember/1440-motion', 'ember/1440-transcript'])
    expect(new Set(groups.map((group) => group.folder)).size).toBe(groups.length)
  })

  it('is left out for a theme with no /chat page', () => {
    expect(shotGroups(['ember'], 1024, ['/deliverables']).filter((group) => group.page !== null)).toEqual([])
    expect(shotGroups(['ember'], 1024)).toHaveLength(3)
  })

  it("opens its shots with the host's reduced motion off, where every other group's turn it on", () => {
    if (motion === undefined) throw new Error('no motion group')
    expect(readSettings(shotAddress(motion, '/chat').slice(1)).reducedMotion).toBe(false)
    expect(readSettings(shotAddress(groups[0] ?? motion, '/chat').slice(1)).reducedMotion).toBe(true)
  })

  it('holds the chat page alone: its one view, and its one file while the theme serves it', () => {
    if (motion === undefined) throw new Error('no motion group')
    expect(groupViews(motion, viewsOf(declared))).toEqual([{ kind: 'page', key: '/chat', path: '/chat' }])
    expect(groupShots(motion, declared, EMPTY_SERVED)).toEqual(['page-chat.png'])
    expect(groupShots(motion, declared, { ...EMPTY_SERVED, pages: ['/chat'] })).toEqual([])
    expect(groupShots(groups[0] ?? motion, declared, EMPTY_SERVED)).toEqual(expectedShots(declared, EMPTY_SERVED))
  })
})
