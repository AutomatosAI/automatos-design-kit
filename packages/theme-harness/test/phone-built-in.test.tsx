// automatos/play and automatos/hud are Automatos Go's own built-in layouts (the app's follow.ts BUILT_IN_THEME_STYLES),
// painted from the member's looks, reading none of the theme's mobile block. That layout is part of the app, so the
// phone view says so in the phone and beside it, draws no part of the Studio layout, no token panel and no theme host
// (the themes' minWidth keeps their web screens off a phone-width browser), and still measures the block. Each theme's
// real theme.json and look data; a small made-up entry stands in for its code. Any other theme id is drawn on the
// Studio layout.
import { defineTheme, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { builtInScreenText } from '../app/phone/built-in.tsx'
import { host } from '../src/host.ts'
import { STAGE_ID } from '../src/host/router.ts'
import { builtInStyleOf, type BuiltInStyle } from '../src/phone/skin.ts'
import { HUD_DIR, PLAY_DIR, readFolder, renderPhone, servedTheme, type Json } from './phone-support.tsx'

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
]

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
  it('are Play and HUD alone', () => {
    expect([builtInStyleOf('automatos/play'), builtInStyleOf('automatos/hud'), builtInStyleOf('example/skin'), builtInStyleOf(7)])
      .toEqual(['play', 'hud', null, null])
  })
})
