/**
 * The `previews` check: each preview theme.json lists, under the preset core's listing shows it with
 * (listings.py `_owner_preset`: `<preset>` or `<preset>-<screen>`, the longest preset id first); a
 * preview no preset claims is a warning, and no previews at all passes. The previews keep theme.json's
 * order and the cover is the first it lists, not the first by name (listings.py `_preview_paths`, as
 * core's test_prd261_theme_listings.py holds it).
 */
import { describe, expect, it } from 'vitest'
import { describePreviews, NO_PREVIEWS, ownerPreset, previewsCheck, UNCLAIMED } from '../src/check/previews.ts'
import { reviewHello, type HelloChange } from './check-support.ts'

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** hello with these previews listed in theme.json and shipped as PNGs. */
function withPreviews(...paths: string[]): HelloChange {
  return { manifest: { previews: paths }, replace: Object.fromEntries(paths.map((path) => [path, PNG_SIGNATURE])) }
}

describe('a preview belongs to the preset its file name gives', () => {
  it.each([
    ['night', { preset: 'night', screen: null }],
    ['night-chat', { preset: 'night', screen: 'chat' }],
    ['night-sky', { preset: 'night-sky', screen: null }],
    ['night-sky-chat', { preset: 'night-sky', screen: 'chat' }],
    ['day', null],
    ['nightly', null],
  ])('%s', (stem, owner) => {
    expect(ownerPreset(stem, ['night', 'night-sky'])).toEqual(owner)
  })
})

describe('the previews check', () => {
  it('passes when every listed preview belongs to a preset, listing them per preset', async () => {
    const { report } = await reviewHello(withPreviews('assets/previews/default.png', 'assets/previews/night-chat.png'))
    expect(report.checks.previews).toMatchObject({
      level: 'pass',
      status: 'checked',
      otherPreviews: [],
      cover: 'assets/previews/default.png',
      presets: [
        { id: 'default', default: true, previews: [{ screen: null, path: 'assets/previews/default.png' }] },
        { id: 'night', default: false, previews: [{ screen: 'chat', path: 'assets/previews/night-chat.png' }] },
      ],
    })
  })

  it('warns on a preview no preset claims, and names it', async () => {
    const { report, texts } = await reviewHello(withPreviews('assets/previews/default.png', 'assets/previews/sunset.png'))
    expect(report.checks.previews).toMatchObject({ level: 'warning', otherPreviews: ['assets/previews/sunset.png'] })
    expect(report.checks.previews.reason).toBe(UNCLAIMED.replace('{count}', '1'))
    expect(texts.previews.items).toEqual(['belongs to no preset: assets/previews/sunset.png'])
    expect(report.verdict).toBe('review_required')
  })

  it("keeps theme.json's order, never by name: the first it lists is the cover, claimed by a preset or not", async () => {
    const order = ['assets/previews/sunset.png', 'assets/previews/night-chat.png', 'assets/previews/default.png', 'assets/previews/default-chat.png']
    const { report, texts } = await reviewHello(withPreviews(...order))
    expect(report.checks.previews).toMatchObject({
      cover: 'assets/previews/sunset.png',
      otherPreviews: ['assets/previews/sunset.png'],
      presets: [
        { id: 'default', previews: [{ screen: null, path: 'assets/previews/default.png' }, { screen: 'chat', path: 'assets/previews/default-chat.png' }] },
        { id: 'night', previews: [{ screen: 'chat', path: 'assets/previews/night-chat.png' }] },
      ],
    })
    const { reason } = (await reviewHello(withPreviews(...order.slice(1)))).report.checks.previews
    expect(reason).toBe('3 preview(s), each under the preset its name gives; the cover is assets/previews/night-chat.png, the first theme.json lists.')
    expect(texts.previews.items).toEqual(['belongs to no preset: assets/previews/sunset.png'])
  })

  it('passes with no previews: the listing shows none, and no cover', async () => {
    const { report } = await reviewHello()
    expect(report.checks.previews).toMatchObject({ level: 'pass', status: 'none', reason: NO_PREVIEWS, otherPreviews: [], cover: null })
  })

  it('reads only listed previews the package holds', () => {
    const files = new Map([['assets/previews/default.png', PNG_SIGNATURE], ['looks/presets/default.look.json', new Uint8Array()]])
    const entry = previewsCheck({ previews: ['assets/previews/default.png', 'assets/previews/gone.png'], look: 'default' }, files)
    expect(entry.presets).toEqual([{ id: 'default', default: true, previews: [{ screen: null, path: 'assets/previews/default.png' }] }])
    expect(describePreviews(entry).items).toEqual([])
  })
})
