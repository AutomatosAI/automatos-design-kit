// lookEditor@1's stand-in, on the kit's harness: its heading carries the host's focus mark, and each preset is a
// toggle that makes it the active look through the SDK, the active one pressed. Outside a look runtime the presets
// can't be picked. HUD's Looks drawer replaces the module, and this test with it.
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLook } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { ARC, FORGE, PRESETS } from '../../src/lib/looks/presets.ts'
import { HudLookEditor, LOOK_EDITOR_TITLE } from '../../src/slots/look-editor.tsx'

function ActiveLook() {
  return <output data-testid="active">{useLook().look?.id ?? 'none'}</output>
}

beforeEach(() => {
  host.reset()
})

describe("the look editor's stand-in", () => {
  it('has a heading the host can hand the focus to', () => {
    render(<HudLookEditor />)
    const heading = screen.getByRole('heading', { level: 1, name: LOOK_EDITOR_TITLE })
    expect(heading).toHaveAttribute('data-theme-heading', 'true')
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it('makes a preset the active look, the active one pressed', () => {
    host.setLooks({ look: ARC })
    render(
      <>
        <HudLookEditor />
        <ActiveLook />
      </>,
    )
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(PRESETS.map((look) => look.name))
    expect(screen.getByRole('button', { name: ARC.name })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: FORGE.name }))
    expect(screen.getByTestId('active')).toHaveTextContent(FORGE.id)
    expect(screen.getByRole('button', { name: FORGE.name })).toHaveAttribute('aria-pressed', 'true')
  })

  it("can't pick a preset outside a look runtime", () => {
    render(<HudLookEditor />)
    expect(screen.getByRole('button', { name: ARC.name })).toBeDisabled()
  })
})
