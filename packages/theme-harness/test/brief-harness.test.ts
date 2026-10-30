// @vitest-environment node
// PRD-268 (SDK 1.3.0): the day's brief in the browser harness (src/host/router.ts, src/host/shot-groups.ts,
// app/host.tsx). The page has the sample brief by default; `brief=off` in the address, or the toolbar's Brief today,
// gives no brief today, as when the workspace's brief is off (core's open answers brief_off and the host stays quiet).
// A theme whose theme.json `uses` names the SDK's proactive area gets one shot group more, its chat page (or every
// view) with no brief, so its shots show both days; every other group keeps the brief.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, readSettings, settingsQuery } from '../src/host/router.ts'
import { CHAT_PAGE, NO_BRIEF_SUFFIX, PROACTIVE_AREA, shotAddress, shotGroups } from '../src/host/shot-groups.ts'

const PRESETS = ['arc', 'forge']
const PAGES = [CHAT_PAGE, '/deliverables']
const HOST_APP = new URL('../app/host.tsx', import.meta.url)
const TOOLBAR = new URL('../app/toolbar.tsx', import.meta.url)

describe('the brief setting', () => {
  it('is on by default and left out of the address; off is `brief=off`, and anything else reads as on', () => {
    expect(DEFAULT_SETTINGS.brief).toBe(true)
    expect(settingsQuery(DEFAULT_SETTINGS)).toBe('')
    expect(settingsQuery({ ...DEFAULT_SETTINGS, brief: false })).toBe('?brief=off')
    expect(readSettings('?brief=off').brief).toBe(false)
    expect(readSettings('?brief=no').brief).toBe(true)
  })

  it('is applied with every setting (app/host.tsx applySettings), and the toolbar switches it', () => {
    const app = readFileSync(HOST_APP, 'utf8')
    const apply = app.slice(app.indexOf('export function applySettings('), app.indexOf('export function prepareHost('))
    expect(apply).toContain('showBrief(settings.brief)')
    expect(readFileSync(TOOLBAR, 'utf8')).toContain('label="Brief today" checked={settings.brief}')
  })
})

describe('the no-brief shot group', () => {
  const groups = shotGroups(PRESETS, 1024, PAGES, ['chat', PROACTIVE_AREA])
  const noBrief = groups.filter((group) => group.brief === false)

  it('shoots the chat page once more for a theme that uses the proactive area, in the default look at 1440, with no brief', () => {
    expect(noBrief).toEqual([{
      folder: `arc/1440${NO_BRIEF_SUFFIX}`, preset: 'arc', width: 1440, height: 900, reducedMotion: true, page: CHAT_PAGE, transcript: false,
      brief: false,
    }])
    expect(readSettings(shotAddress(noBrief[0], CHAT_PAGE).slice(1))).toMatchObject({ brief: false, path: CHAT_PAGE, toolbar: false })
  })

  it('leaves every other group on the brief, and gives none to a theme that does not use the area', () => {
    groups.filter((group) => group.brief === undefined).forEach((group) => expect(shotAddress(group, CHAT_PAGE)).not.toContain('brief='))
    expect(shotGroups(PRESETS, 1024, PAGES, ['chat', 'voice']).filter((group) => group.brief === false)).toEqual([])
    expect(shotGroups(PRESETS, 1024, ['/deliverables'], [PROACTIVE_AREA]).find((group) => group.brief === false)?.page).toBeNull()
  })
})
