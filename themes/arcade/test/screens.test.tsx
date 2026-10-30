// Arcade's slots on the harness: the entry registers exactly what theme.json declares; the Options screen changes a
// knob, saves a look and resets through the host's look runtime, says when nothing is kept, and previews the look;
// the Sprite gallery shows Auto's twelve states and the design's pairs; the 404 links back to the chat; the shared
// empty state shows Auto asleep.
import { type HostLookResult, listLooks, SDK_VERSION, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { MASCOT_STATES } from '@automatos/mascot/types'

import { EmptyStateAuto } from '../src/edges/empty-state.tsx'
import { BACK_TO_CHAT, NotFound } from '../src/edges/not-found.tsx'
import theme from '../src/entry.ts'
import { EDITOR_HEADING, LookEditor, NO_RUNTIME, RESET } from '../src/looks/look-editor.tsx'
import { PREVIEW } from '../src/looks/look-preview.tsx'
import { DESIGN_PAIRS } from '../src/looks/pairs.ts'
import { DEFAULT_LOOK, KNOBS, LOOK_SCHEMA, PRESETS, type ThemeLook } from '../src/looks/spec.ts'
import { SAVE_AS_NEW } from '../src/looks/look-transfer.tsx'
import { GALLERY, PAIRS, StyleSheet } from '../src/style/style-sheet.tsx'

const THEME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(THEME_DIR, 'theme.json'), 'utf8')) as {
  readonly slots: string[]
  readonly pages: Readonly<Record<string, unknown>>
  readonly routes: string[]
}

/** The host's look check, as it makes it from looks/schema.json: the schema and one of its choices per knob. */
function checkLook(look: unknown): HostLookResult {
  const fields = (look ?? {}) as Readonly<Record<string, unknown>>
  const fits = KNOBS.every((knob) => knob.choices.some((choice) => choice.key === fields[knob.name]))
  return fields.schema === LOOK_SCHEMA && fits ? { ok: true, look: look as ThemeLook } : { ok: false, errors: ['Not a look of Arcade.'] }
}

function withRuntime(look: ThemeLook = DEFAULT_LOOK): void {
  host.setLooks({ look, defaultLook: DEFAULT_LOOK, check: checkLook })
}

beforeEach(() => {
  host.reset()
  host.setReducedMotion(true)
})

describe('the entry', () => {
  it('registers exactly the slots, pages and route theme.json declares', () => {
    const slots: string[] = []
    const pages: string[] = []
    const routes: string[] = []
    const registration: ThemeRegistrationHost = {
      sdkVersion: SDK_VERSION,
      hostVersion: '1.1.0',
      registerSlot: (id) => void slots.push(id),
      registerPage: (route) => void pages.push(route),
      registerRoute: (path) => void routes.push(path),
    }
    theme.register(registration)
    expect(slots.sort()).toEqual([...manifest.slots].sort())
    expect(pages.sort()).toEqual(Object.keys(manifest.pages).sort())
    expect(routes).toEqual(manifest.routes)
  })
})

describe('the Options screen', () => {
  it('changes a knob through the host, so the whole app repaints', () => {
    withRuntime()
    render(<LookEditor />)
    expect(screen.getByRole('heading', { name: EDITOR_HEADING })).toBeInTheDocument()
    const palette = screen.getByRole('group', { name: 'Palette' })
    fireEvent.click(within(palette).getByRole('radio', { name: 'Dungeon' }))
    expect(within(palette).getByRole('radio', { name: 'Dungeon' })).toBeChecked()
    expect(screen.getByRole('region', { name: PREVIEW })).toHaveTextContent('Dungeon')
  })

  it('saves the look as a new save slot, and Reset goes back to the palette as it ships', () => {
    withRuntime()
    render(<LookEditor />)
    fireEvent.click(within(screen.getByRole('group', { name: 'Text speed' })).getByRole('radio', { name: 'Slow' }))
    fireEvent.click(screen.getByRole('button', { name: SAVE_AS_NEW }))
    expect(listLooks().map((look) => [look.name, (look as ThemeLook).textSpeed])).toEqual([['Save slot 1', 'slow']])
    fireEvent.click(screen.getByRole('button', { name: RESET }))
    expect(within(screen.getByRole('group', { name: 'Text speed' })).getByRole('radio', { name: 'Normal' })).toBeChecked()
  })

  it('offers every preset as a save slot', () => {
    withRuntime()
    render(<LookEditor />)
    PRESETS.forEach((preset) => expect(screen.getByRole('button', { name: new RegExp(preset.name) })).toBeInTheDocument())
  })

  it('says nothing is kept outside a look runtime', () => {
    render(<LookEditor />)
    expect(screen.getByText(NO_RUNTIME)).toBeInTheDocument()
  })
})

describe('the Sprite gallery', () => {
  it("shows Auto's twelve states and the design's pairs", () => {
    withRuntime()
    render(<StyleSheet />)
    const gallery = screen.getByRole('region', { name: GALLERY })
    expect(within(gallery).getAllByRole('listitem')).toHaveLength(MASCOT_STATES.length)
    MASCOT_STATES.forEach((state) => expect(gallery).toHaveTextContent(state))
    const pairs = screen.getByRole('region', { name: PAIRS })
    expect(within(pairs).getAllByRole('listitem')).toHaveLength(DESIGN_PAIRS.length)
  })
})

describe('the edges', () => {
  it('links the 404 back to the chat', () => {
    render(<NotFound />)
    expect(screen.getByRole('link', { name: BACK_TO_CHAT })).toHaveAttribute('href', '/chat')
  })

  it('draws Auto asleep in the shared empty state, as decoration', () => {
    const { container } = render(<EmptyStateAuto base="studio" title="Nothing yet" />)
    const sprite = container.querySelector('[data-state="sleeping"] svg')
    expect(sprite).toHaveAttribute('aria-hidden', 'true')
  })
})
