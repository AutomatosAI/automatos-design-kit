// Play 1.1.1: the looks page had three names: "Look" in the sidebar, "Make it yours." as its heading and "Make it
// yours" as theme.json's nav label. It is Look everywhere now: the nav (Play's sidebar and theme.json's), the page's
// heading and the style sheet's way back; "Make it yours." lives on only as the tagline under the heading.
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOOKS_HEADING, LOOKS_LEAD, LOOKS_TITLE } from '../../src/components/looks/looks-screen.tsx'
import { BACK_TO_LOOKS } from '../../src/components/looks/style/style-screen.tsx'
import { PLAY_LOOK_ITEM } from '../../src/components/play/shell/play-nav.ts'
import { EMBER } from '../../src/lib/looks/presets.ts'
import { readThemeFile } from '../source-files.ts'
import { lookHeld, renderLooks, startLooksTest } from './looks-harness.tsx'

const NAME = 'Look'
const TAGLINE = 'Make it yours.'

interface NavEntry {
  readonly id: string
  readonly label: string
  readonly path: string
}

const manifestNav = (): readonly NavEntry[] => (JSON.parse(readThemeFile('theme.json')) as { readonly nav: readonly NavEntry[] }).nav

beforeEach(() => {
  startLooksTest()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the Look page has one name (Play 1.1.1)', () => {
  it("is Look in theme.json's nav and in Play's sidebar, at /looks", () => {
    expect(manifestNav().find((entry) => entry.path === PLAY_LOOK_ITEM.href)?.label).toBe(NAME)
    expect(PLAY_LOOK_ITEM.label).toBe(NAME)
    expect([LOOKS_TITLE, LOOKS_HEADING]).toEqual([NAME, NAME])
    expect(BACK_TO_LOOKS).toBe(`Back to ${NAME}`)
  })

  it("heads the page Look, with 'Make it yours.' only as the tagline under it", async () => {
    renderLooks()
    await lookHeld(EMBER)
    const heading = screen.getByRole('heading', { level: 1, name: NAME })
    expect(LOOKS_LEAD.startsWith(TAGLINE)).toBe(true)
    expect(heading.nextElementSibling).toHaveTextContent(LOOKS_LEAD)
    expect(screen.queryByRole('heading', { name: TAGLINE })).toBeNull()
  })
})
