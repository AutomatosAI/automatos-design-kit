// @vitest-environment node
// The shots' phone-width group (src/host/shot-groups.ts) and the toolbar's phone width (src/host/router.ts). A theme
// whose minWidth is at most a phone's 390 px is shot at 390 × 844 too: each preset, every view, with reduced motion,
// in `<preset>/390/`, and with a /chat page the chat on the transcript in the default look, in
// `<preset>/390-transcript/`. A theme whose minWidth is above it gets no phone group (below its minWidth the host draws
// its own pages, which the below-minWidth group shows). Each group names its viewport, which the spec sizes the page
// to: 900 tall in every other group. The toolbar offers 390 beside the desktop widths, widest first. Made-up presets.
import { describe, expect, it } from 'vitest'
import { EMPTY_SERVED, PHONE_VIEWPORT, readSettings, viewsOf, widthChoices, type Served } from '../src/host/router.ts'
import {
  DESKTOP_HEIGHT, fitsPhone, groupShots, groupViews, shotAddress, shotGroups, type ShotGroup,
} from '../src/host/shot-groups.ts'

const PRESETS = ['ember', 'aurora']
const DECLARED: Served = { slots: ['frame@1', 'lookEditor@1'], pages: ['/chat', '/deliverables'], routes: ['notes'] }

/** In the phone's viewport: its width and its height (a theme with minWidth 391 has a below-minWidth group 390 wide). */
const inPhone = (group: ShotGroup): boolean => group.width === PHONE_VIEWPORT.width && group.height === PHONE_VIEWPORT.height
const atPhone = (groups: readonly ShotGroup[]): ShotGroup[] => groups.filter(inPhone)

describe('the phone viewport', () => {
  it("is an iPhone's 390 × 844 points, a point a CSS pixel", () => {
    expect(PHONE_VIEWPORT).toEqual({ width: 390, height: 844 })
    expect(DESKTOP_HEIGHT).toBe(900)
  })
})

describe('the phone-width group', () => {
  const groups = shotGroups(PRESETS, 360, DECLARED.pages)
  const phone = atPhone(groups)

  it('shoots every view of each preset at 390 × 844 with reduced motion, then the chat on the transcript', () => {
    expect(phone).toEqual([
      { folder: 'ember/390', preset: 'ember', width: 390, height: 844, reducedMotion: true, page: null, transcript: false },
      { folder: 'aurora/390', preset: 'aurora', width: 390, height: 844, reducedMotion: true, page: null, transcript: false },
      {
        folder: 'ember/390-transcript', preset: 'ember', width: 390, height: 844, reducedMotion: true, page: '/chat', transcript: true,
      },
    ])
    expect(groups.slice(-phone.length)).toEqual(phone)
    expect(new Set(groups.map((group) => group.folder)).size).toBe(groups.length)
  })

  it('is given exactly when minWidth is at most 390', () => {
    const phoneFolders = (minWidth: number): string[] => atPhone(shotGroups(PRESETS, minWidth)).map((group) => group.folder)
    expect([0, 320, 360, 390].map(fitsPhone)).toEqual([true, true, true, true])
    expect([391, 768, 1024].map(fitsPhone)).toEqual([false, false, false])
    const sweep = [0, 320, 359, 360, 389, 390, 391, 768, 1023, 1024, 3840]
    expect(sweep.filter((minWidth) => phoneFolders(minWidth).length > 0)).toEqual([0, 320, 359, 360, 389, 390])
    expect(phoneFolders(390)).toEqual(['ember/390', 'aurora/390'])
    expect(phoneFolders(0)).toEqual(['ember/390', 'aurora/390'])
    expect(phoneFolders(391)).toEqual([])
    expect(shotGroups(PRESETS, 391).find((group) => group.folder === 'below-390'))
      .toMatchObject({ preset: 'ember', width: 390, height: DESKTOP_HEIGHT, page: null })
    expect(shotGroups(PRESETS, 390).find((group) => group.folder === 'below-389')).toMatchObject({ width: 389, height: DESKTOP_HEIGHT })
    expect(phoneFolders(1024)).toEqual([])
  })

  it('has no transcript group for a theme with no /chat page, and a default folder for a theme with no preset', () => {
    expect(atPhone(shotGroups(PRESETS, 360, ['/deliverables'])).every((group) => group.page === null)).toBe(true)
    expect(atPhone(shotGroups([], 360)).map((group) => group.folder)).toEqual(['default/390'])
    expect(atPhone(shotGroups([], 360, ['/chat'])).map((group) => group.folder)).toEqual(['default/390', 'default/390-transcript'])
  })

  it('leaves the other groups as they are, each 900 tall: the desktop widths, below minWidth and the chat groups', () => {
    const others = groups.filter((group) => !inPhone(group))
    expect(others.map((group) => group.folder)).toEqual([
      'ember/1440', 'ember/1024', 'aurora/1440', 'aurora/1024', 'below-359', 'ember/1440-motion', 'ember/1440-transcript',
    ])
    expect(others.every((group) => group.height === DESKTOP_HEIGHT)).toBe(true)
  })

  it('opens each shot at the phone width, with no toolbar, and holds every view, or the chat page alone', () => {
    const first = phone.find((group) => !group.transcript)
    const transcript = phone.find((group) => group.transcript)
    if (first === undefined || transcript === undefined) throw new Error('no phone group')
    expect(readSettings(shotAddress(first, '/chat').slice(1))).toMatchObject({ width: 390, reducedMotion: true, toolbar: false })
    expect(readSettings(shotAddress(transcript, '/chat').slice(1))).toMatchObject({ width: 390, transcript: true })
    expect(groupViews(first, viewsOf(DECLARED))).toEqual(viewsOf(DECLARED))
    expect(groupShots(transcript, DECLARED, EMPTY_SERVED)).toEqual(['page-chat.png'])
  })
})

describe("the toolbar's widths", () => {
  const values = (minWidth: number): string[] => widthChoices(minWidth).map((choice) => choice.value)

  it('offer the phone width beside the desktop widths and the one below minWidth, widest first', () => {
    expect(values(1024)).toEqual(['window', '1440', '1024', '1023', '390'])
    expect(values(360)).toEqual(['window', '1440', '1024', '390', '359'])
    expect(widthChoices(360).find((choice) => choice.width === 390)?.label).toBe('390 px (phone)')
  })

  it('offer each width once, and no width below minWidth when none is below it', () => {
    expect(values(391)).toEqual(['window', '1440', '1024', '390'])
    expect(values(1025)).toEqual(['window', '1440', '1024', '390'])
    expect(values(320)).toEqual(['window', '1440', '1024', '390'])
  })
})
