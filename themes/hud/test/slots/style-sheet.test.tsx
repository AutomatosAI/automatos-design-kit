// styleSheet@1's stand-in, on the kit's harness: its heading carries the host's focus mark, and it names the active
// look's accent, background and type in words. HUD's style sheet replaces the module, and this test with it.
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { NOVA } from '../../src/lib/looks/presets.ts'
import { HudStyleSheet, STYLE_SHEET_TITLE } from '../../src/slots/style-sheet.tsx'

beforeEach(() => {
  host.reset()
})

describe("the style sheet's stand-in", () => {
  it('has a heading the host can hand the focus to', () => {
    render(<HudStyleSheet />)
    expect(screen.getByRole('heading', { level: 1, name: STYLE_SHEET_TITLE })).toHaveAttribute('data-theme-heading', 'true')
  })

  it("names the active look's choices", () => {
    host.setLooks({ look: NOVA })
    render(<HudStyleSheet />)
    expect(screen.getByRole('heading', { level: 2, name: NOVA.name })).toBeInTheDocument()
    expect(screen.getByText('Nova')).toBeInTheDocument()
    expect(screen.getByText('Navy')).toBeInTheDocument()
    expect(screen.getByText('Chakra Petch')).toBeInTheDocument()
  })
})
