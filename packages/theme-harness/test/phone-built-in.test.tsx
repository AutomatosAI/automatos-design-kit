// automatos/play, automatos/hud, automatos/arcade and automatos/candy are Automatos Go's own built-in layouts (the
// app's follow.ts BUILT_IN_THEME_STYLES), painted from the member's looks, reading none of the theme's mobile block.
// That layout is part of the app, so the phone view says so in the phone and beside it, draws no part of the Studio
// layout, no token panel and no theme host (Automatos Go runs no theme code), and still measures the block. That
// holds whatever the theme's own minWidth: each theme is drawn with a phone's width and with a desktop width as its
// minWidth too, so the tests never depend on the number its theme.json declares. Each theme's real theme.json and
// look data; a small made-up entry stands in for its code. Any other theme id is drawn on the Studio layout.
import { defineTheme, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { builtInScreenText } from '../app/phone/built-in.tsx'
import { host } from '../src/host.ts'
import { PHONE_VIEWPORT, SHOT_WIDTHS, STAGE_ID } from '../src/host/router.ts'
import { builtInStyleOf, type BuiltInStyle } from '../src/phone/skin.ts'
import { ARCADE_DIR, CANDY_DIR, HUD_DIR, PLAY_DIR, readFolder, renderPhone, servedTheme, type Json } from './phone-support.tsx'

function Frame({ children }: { readonly children?: ReactNode }) {
  return <div data-testid="theme-frame">{children}</div>
}

const entry = (): Promise<unknown> => Promise.resolve({
  default: defineTheme({ register: (registration: ThemeRegistrationHost) => registration.registerSlot('frame@1', Frame) }),
})

/** Each built-in theme: its id, its folder, its style and the layout's name. */
const BUILT_IN: [string, string, BuiltInStyle, string][] = [
  ['automatos/play', PLAY_DIR, 'play', 'Play'],
  ['automatos/hud', HUD_DIR, 'hud', 'HUD'],
  ['automatos/arcade', ARCADE_DIR, 'arcade', 'Arcade'],
  ['automatos/candy', CANDY_DIR, 'candy', 'Candy'],
]
/** The minWidths each theme is drawn with besides its own: a phone's width, and the narrower desktop width. */
const MIN_WIDTHS: number[] = [PHONE_VIEWPORT.width, SHOT_WIDTHS[1]]

beforeEach(() => {
  host.reset()
})

describe.each(BUILT_IN)('%s', (id, dir, style, name) => {
  const folder = readFolder(dir)

  it(`is the phone's built-in ${name} layout, which the harness doesn't draw: no theme host, no Studio part`, () => {
    expect((folder.served.manifest as Json).id).toBe(id)
    renderPhone(servedTheme(folder.served, entry))
    expect(document.querySelector('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'built-in')
    expect(document.querySelector('[data-phone-notice]')).toHaveTextContent(`built-in ${name} layout`)
    expect(document.querySelector('[data-go-built-in]')).toHaveAttribute('data-go-built-in', style)
    expect(document.querySelector('[data-go-built-in]')).toHaveTextContent(builtInScreenText(style))
    expect(document.getElementById(STAGE_ID)).toBeNull()
    expect(screen.queryByTestId('theme-frame')).toBeNull()
    expect(document.querySelectorAll('[data-go-part]')).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: 'Where each token lands' })).toBeNull()
    expect(screen.getByRole('heading', { name: /^Contrast, as automatos-theme check measures it/ })).toBeInTheDocument()
  })

  it.each(MIN_WIDTHS)('is the built-in layout whatever its minWidth: with %i px it draws no theme host either', (minWidth) => {
    const manifest = { ...(folder.served.manifest as Json), minWidth }
    renderPhone(servedTheme({ ...folder.served, manifest }, entry))
    expect(document.querySelector('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'built-in')
    expect(document.querySelector('[data-go-built-in]')).toHaveTextContent(builtInScreenText(style))
    expect(document.getElementById(STAGE_ID)).toBeNull()
    expect(screen.queryByTestId('theme-frame')).toBeNull()
  })

  it("offers the theme's looks to measure, and no screen switch draws a host", () => {
    const theme = servedTheme(folder.served, entry)
    renderPhone(theme)
    const looks = screen.getByLabelText(/^Look/)
    theme.presets.forEach((preset) => expect(looks.querySelector(`option[value="${preset.id}"]`)).not.toBeNull())
    fireEvent.change(looks, { target: { value: theme.presets[1].id } })
    fireEvent.change(screen.getByLabelText(/^Screen/), { target: { value: 'command-centre' } })
    expect(document.getElementById(STAGE_ID)).toBeNull()
    expect(document.querySelector('[data-go-built-in]')).toHaveTextContent(builtInScreenText(style))
  })
})

describe('the built-in layouts', () => {
  it('are Play, HUD, Arcade and Candy alone', () => {
    expect([
      builtInStyleOf('automatos/play'), builtInStyleOf('automatos/hud'), builtInStyleOf('automatos/arcade'),
      builtInStyleOf('automatos/candy'), builtInStyleOf('example/skin'), builtInStyleOf(7),
    ]).toEqual(['play', 'hud', 'arcade', 'candy', null, null])
  })
})
