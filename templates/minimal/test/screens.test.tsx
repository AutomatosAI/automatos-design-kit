// The theme's screens on the kit's harness, with nothing of Automatos running. The entry registers exactly the slots
// theme.json declares. The frame draws the page it is handed inside the host's menu and utilities, and its links move
// the host's router. The look editor picks a preset and changes a knob through the host's look runtime, saves a new
// look and shows a refused import in the host's words; outside a runtime it says nothing is kept. The style sheet
// names the active look and draws a swatch for every colour; the 404 links back to the chat.
import { listLooks, SDK_VERSION, type HostLookResult, type ThemeRegistrationHost } from '@automatos/theme-sdk'
import { host } from '@automatos/theme-harness/host'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import theme from '../src/entry.ts'
import { NotFound } from '../src/edges/not-found.tsx'
import { Frame } from '../src/frame/frame.tsx'
import { LookEditor, NO_RUNTIME } from '../src/looks/look-editor.tsx'
import { DAY, KNOBS, LOOK_SCHEMA, NIGHT, type ThemeLook } from '../src/looks/spec.ts'
import { StyleSheet, activeLookLine } from '../src/style/style-sheet.tsx'
import { COLOURS } from '../src/style/tokens.ts'
import { THEME_NAME } from '../src/theme.ts'

const manifest = JSON.parse(readFileSync(new URL('../theme.json', import.meta.url), 'utf8')) as { readonly slots: string[] }
const NOT_A_LOOK = 'That is not a look of this theme.'

/** The host's look runtime check, as the host makes it from looks/schema.json: the schema and a choice per knob. */
function checkLook(look: unknown): HostLookResult {
  const fields = (look ?? {}) as Readonly<Record<string, unknown>>
  const named = ['id', 'name', 'sub'].every((field) => typeof fields[field] === 'string')
  const fits = KNOBS.every((knob) => knob.choices.some((choice) => choice.key === fields[knob.name]))
  if (!named || !fits || fields.schema !== LOOK_SCHEMA) return { ok: false, errors: [NOT_A_LOOK] }
  return { ok: true, look: { ...(look as ThemeLook) } }
}

function mountLooks(look: ThemeLook = DAY): void {
  host.setLooks({ look, defaultLook: DAY, check: checkLook })
}

const pressed = (name: RegExp): string | null => screen.getByRole('button', { name }).getAttribute('aria-pressed')

beforeEach(() => {
  host.reset()
})

describe('the entry', () => {
  it("registers exactly theme.json's slots, and no page or route", () => {
    const slots: string[] = []
    const others: string[] = []
    const registration: ThemeRegistrationHost = {
      sdkVersion: SDK_VERSION,
      hostVersion: '1.1.0',
      registerSlot: (slot) => slots.push(slot),
      registerPage: (route) => others.push(route),
      registerRoute: (path) => others.push(path),
    }
    theme.register(registration)
    expect([slots.sort(), others]).toEqual([[...manifest.slots].sort(), []])
  })
})

describe('the frame', () => {
  it("draws the page inside the host's menu, utilities and the theme's name", () => {
    render(<Frame autoWidget={<p>The host's Auto</p>}><p>The page</p></Frame>)
    expect(screen.getByText('The page')).toBeInTheDocument()
    expect(screen.getByText("The host's Auto")).toBeInTheDocument()
    expect(screen.getByText(THEME_NAME)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Header utilities' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link').length).toBeGreaterThan(2)
  })

  it("marks the screen on show and moves the host's router", () => {
    act(() => host.setPathname('/looks/style'))
    render(<Frame><p>The page</p></Frame>)
    expect(screen.getByRole('link', { name: 'Style sheet' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('link', { name: 'Make it yours' }))
    expect(host.navigations()).toEqual([{ method: 'push', href: '/looks' }])
  })
})

describe('the look editor', () => {
  it("picks a preset and changes a knob through the host's look runtime", () => {
    mountLooks()
    render(<LookEditor />)
    expect(pressed(/^Day/)).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^Night/ }))
    expect([pressed(/^Day/), pressed(/^Night/)]).toEqual(['false', 'true'])
    fireEvent.click(screen.getByRole('radio', { name: 'Amber' }))
    expect(screen.getByRole('radio', { name: 'Amber' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Ink' })).toBeChecked()
  })

  it('saves the active look as a new one and makes it active', () => {
    mountLooks(NIGHT)
    render(<LookEditor />)
    fireEvent.click(screen.getByRole('button', { name: 'Save as a new look' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved My look 1.')
    expect(pressed(/^My look 1/)).toBe('true')
    expect(listLooks().map((look) => look.id)).toEqual(['mine-1'])
  })

  it("shows a refused import in the host's words, and adds nothing", () => {
    mountLooks()
    render(<LookEditor />)
    fireEvent.change(screen.getByLabelText("Paste a look's JSON"), { target: { value: 'not a look' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_A_LOOK)
    expect(listLooks()).toEqual([])
  })

  it('says so outside a look runtime', () => {
    render(<LookEditor />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('data-theme-heading')
    expect(screen.getByText(NO_RUNTIME)).toBeInTheDocument()
  })
})

describe('the style sheet and the 404', () => {
  it('names the active look and draws a swatch for every colour', () => {
    mountLooks(NIGHT)
    render(<StyleSheet />)
    expect(screen.getByText(activeLookLine(NIGHT.name))).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Colours' })).getAllByRole('listitem')).toHaveLength(COLOURS.length)
  })

  it('links back to the chat', () => {
    render(<NotFound />)
    expect(screen.getByRole('link', { name: 'Back to chat' })).toHaveAttribute('href', '/chat')
  })
})
