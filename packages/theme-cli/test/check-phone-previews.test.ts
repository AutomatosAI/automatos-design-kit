/**
 * The `previews` check on phone screenshots (theme.json's `phonePreviews`, assets/previews/phone/<NAME>.png or .jpg):
 * the same rule as the web's puts each under a preset (listings.py `_claimed` over `_stem` and `_owner_preset`: the
 * stem without its folder and extension is `<preset>` or `<preset>-<screen>`, the longest preset id first), in
 * theme.json's order, the first the phone cover; one no preset claims is a warning. A theme without phone screenshots
 * answers no phone screenshot on every preset and no phone cover, as core's listing does.
 */
import { describe, expect, it } from 'vitest'
import {
  describePreviews, NO_PREVIEWS, NO_WEB_PREVIEWS, PHONE_UNCLAIMED, previewsCheck, previewStem, type PreviewsEntry,
} from '../src/check/previews.ts'
import type { Reviewed } from '../src/check/index.ts'
import { reviewHello, type HelloChange } from './check-support.ts'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const PHONE = 'assets/previews/phone/'
const WEB = 'assets/previews/'
/** A third preset beside hello's default and night, for the longest-id rule. */
const NIGHT_SKY = 'looks/presets/night-sky.look.json'
const NIGHT_SKY_LOOK = JSON.stringify({
  schema: 'automatos-e2e-hello-look/v1', id: 'night-sky', name: 'Night sky', sub: '', accent: 'green', ground: 'ink', radius: 0,
})

/** hello with these web previews and phone screenshots listed and shipped, each by its extension's bytes. */
function withScreens(phone: readonly string[], web: readonly string[] = [], extra: HelloChange['replace'] = {}): HelloChange {
  const bytes = (path: string): Uint8Array => (path.endsWith('.jpg') ? JPEG : PNG)
  const files = Object.fromEntries([...web, ...phone].map((path) => [path, bytes(path)]))
  const manifest = { ...(web.length > 0 ? { previews: web } : {}), phonePreviews: phone }
  return { manifest, replace: { ...files, ...extra } }
}

/** The report's `previews` entry, as check/previews.ts types it. */
function previewsOf({ report }: Reviewed): PreviewsEntry {
  return report.checks.previews as unknown as PreviewsEntry
}

describe("a phone screenshot's stem", () => {
  it.each([
    [`${PHONE}night.jpg`, PHONE, 'night'],
    [`${PHONE}night-chat.png`, PHONE, 'night-chat'],
    [`${PHONE}night.v2-chat.jpg`, PHONE, 'night.v2-chat'],
    [`${WEB}night-chat.png`, WEB, 'night-chat'],
  ])('%s, in %s, is %s', (path, folder, stem) => {
    expect(previewStem(path, folder)).toBe(stem)
  })
})

describe('the previews check on phone screenshots', () => {
  it('lists each phone screenshot under the preset its name gives, PNG or JPEG, the first listed the phone cover', async () => {
    const phone = [`${PHONE}night-chat.png`, `${PHONE}default.jpg`, `${PHONE}default-agents.jpg`]
    const { report } = await reviewHello(withScreens(phone, [`${WEB}default.png`]))
    expect(report.checks.previews).toMatchObject({
      level: 'pass',
      status: 'checked',
      cover: `${WEB}default.png`,
      phoneCover: `${PHONE}night-chat.png`,
      otherPreviews: [],
      otherPhonePreviews: [],
      presets: [
        {
          id: 'default',
          previews: [{ screen: null, path: `${WEB}default.png` }],
          phonePreviews: [{ screen: null, path: `${PHONE}default.jpg` }, { screen: 'agents', path: `${PHONE}default-agents.jpg` }],
        },
        { id: 'night', previews: [], phonePreviews: [{ screen: 'chat', path: `${PHONE}night-chat.png` }] },
      ],
    })
    expect(report.checks.previews.reason).toBe(
      `1 preview(s), each under the preset its name gives; the cover is ${WEB}default.png, the first theme.json lists. `
      + `3 phone screenshot(s), each under the preset its name gives; the phone cover is ${PHONE}night-chat.png, the first theme.json lists.`,
    )
  })

  it('gives a stem two presets match to the longer id, as the web previews', async () => {
    const phone = [`${PHONE}night-sky-chat.jpg`, `${PHONE}night-chat.jpg`]
    const reviewed = await reviewHello(withScreens(phone, [], { [NIGHT_SKY]: NIGHT_SKY_LOOK }))
    const byId = Object.fromEntries(previewsOf(reviewed).presets.map((preset) => [preset.id, preset.phonePreviews]))
    expect(byId).toEqual({
      default: [],
      night: [{ screen: 'chat', path: `${PHONE}night-chat.jpg` }],
      'night-sky': [{ screen: 'chat', path: `${PHONE}night-sky-chat.jpg` }],
    })
  })

  it('warns on a phone screenshot no preset claims, and names it; with no web previews the card has no cover', async () => {
    const phone = [`${PHONE}sunset.png`, `${PHONE}default.png`]
    const { report, texts } = await reviewHello(withScreens(phone))
    expect(report.checks.previews).toMatchObject({
      level: 'warning', status: 'checked', cover: null, phoneCover: `${PHONE}sunset.png`, otherPhonePreviews: [`${PHONE}sunset.png`],
    })
    expect(report.checks.previews.reason).toBe(`${NO_WEB_PREVIEWS} ${PHONE_UNCLAIMED.replace('{count}', '1')}`)
    expect(texts.previews.items).toEqual([`belongs to no preset: ${PHONE}sunset.png`])
    expect(report.verdict).toBe('review_required')
  })

  it('answers no phone screenshot on every preset and no phone cover for a theme that lists none', async () => {
    const reviewed = await reviewHello()
    expect(previewsOf(reviewed)).toMatchObject({ status: 'none', reason: NO_PREVIEWS, phoneCover: null, otherPhonePreviews: [] })
    expect(previewsOf(reviewed).presets.map((preset) => preset.phonePreviews)).toEqual([[], []])
  })

  it('reads only listed phone screenshots the package holds, and never a web preview as one', () => {
    const files = new Map([
      [`${PHONE}default.jpg`, JPEG], [`${WEB}default.png`, PNG], ['looks/presets/default.look.json', new Uint8Array()],
    ])
    const manifest = { phonePreviews: [`${PHONE}default.jpg`, `${PHONE}gone.jpg`], previews: [`${WEB}default.png`], look: 'default' }
    const entry = previewsCheck(manifest, files)
    expect(entry.presets).toEqual([{
      id: 'default', default: true,
      previews: [{ screen: null, path: `${WEB}default.png` }],
      phonePreviews: [{ screen: null, path: `${PHONE}default.jpg` }],
    }])
    expect(describePreviews(entry).items).toEqual([])
  })
})
