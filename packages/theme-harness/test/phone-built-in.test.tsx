// automatos/play and automatos/hud are Automatos Go's own built-in layouts (the app's follow.ts BUILT_IN_THEME_STYLES),
// painted from the member's looks, reading none of the theme's mobile block: the phone view says so, draws no part of
// the Studio layout and no token panel, and draws the theme's own screens in the phone at its 390-pixel width through
// the harness's host, whatever the theme's minWidth (each theme's real theme.json and look data; a small made-up entry
// stands in for its code). The screen switch moves the host's path, the look switch its look; the contrast panel
// still measures the block, as the review does. Any other theme id is drawn on the Studio layout.
import { defineTheme, useLook, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BUILT_IN_PATHS } from '../app/phone/built-in.tsx'
import { host } from '../src/host.ts'
import { STAGE_ID } from '../src/host/router.ts'
import { builtInStyleOf } from '../src/phone/skin.ts'
import { HUD_DIR, PLAY_DIR, readFolder, renderPhone, servedTheme, type Json } from './phone-support.tsx'

function Frame({ children }: { readonly children?: ReactNode }) {
  return <div data-testid="theme-frame">{children}</div>
}

function ChatPage() {
  return <p data-testid="theme-chat">{`look ${useLook().look?.id ?? 'none'}`}</p>
}

const entry = (): Promise<unknown> => Promise.resolve({
  default: defineTheme({
    register: (registration: ThemeRegistrationHost) => {
      registration.registerSlot('frame@1', Frame)
      registration.registerPage('/chat', ChatPage)
    },
  }),
})

const BUILT_IN = [['automatos/play', PLAY_DIR, 'Play'], ['automatos/hud', HUD_DIR, 'HUD']] as const

beforeEach(() => {
  host.reset()
})

describe.each(BUILT_IN)('%s', (id, dir, style) => {
  const folder = readFolder(dir)

  it(`is the phone's built-in ${style} layout: the theme's own screen at 390 pixels, no Studio part`, async () => {
    expect((folder.served.manifest as Json).id).toBe(id)
    renderPhone(servedTheme(folder.served, entry))
    expect(document.querySelector('[data-phone-mode]')).toHaveAttribute('data-phone-mode', 'built-in')
    expect(document.querySelector('[data-phone-notice]')).toHaveTextContent(`built-in ${style} layout`)
    expect(await screen.findByTestId('theme-chat')).toBeInTheDocument()
    expect(document.getElementById(STAGE_ID)?.style.width).toBe('390px')
    expect(document.querySelectorAll('[data-go-part]')).toHaveLength(0)
    expect(screen.queryByRole('heading', { name: 'Where each token lands' })).toBeNull()
    expect(screen.getByRole('heading', { name: /^Contrast, as automatos-theme check measures it/ })).toBeInTheDocument()
  })

  it('moves the host to the screen chosen and paints the look chosen', async () => {
    const theme = servedTheme(folder.served, entry)
    renderPhone(theme)
    const [first, second] = theme.presets
    expect(await screen.findByTestId('theme-chat')).toHaveTextContent(`look ${first.id}`)
    fireEvent.change(screen.getByLabelText(/^Look/), { target: { value: second.id } })
    expect(screen.getByTestId('theme-chat')).toHaveTextContent(`look ${second.id}`)
    fireEvent.change(screen.getByLabelText(/^Screen/), { target: { value: 'command-centre' } })
    expect(document.getElementById(STAGE_ID)).toHaveAttribute('data-harness-view', `base:${BUILT_IN_PATHS['command-centre']}`)
    expect(screen.getByTestId('theme-frame')).toBeInTheDocument()
  })
})

describe('the built-in layouts', () => {
  it('are Play and HUD alone', () => {
    expect([builtInStyleOf('automatos/play'), builtInStyleOf('automatos/hud'), builtInStyleOf('example/skin'), builtInStyleOf(7)])
      .toEqual(['play', 'hud', null, null])
  })
})
