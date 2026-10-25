// The views as the mock host draws them under a theme (src/host/slots.ts), held to core: the 404 (notFound@1) alone,
// with no frame, as core's frontend/app/not-found.tsx draws it through ThemeSlot (components/theme-host/theme-slot.tsx,
// ThemeNamedSlot, unframed); every other view inside the theme's frame@1, full bleed for a page, a route and the looks
// pages (lookEditor@1, styleSheet@1: core's theme-slot-page.tsx draws them in <MainLayout fullBleed>), in the frame's
// own layout for its own view and the host's pages. Made-up components, registered here.
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { Registrations, ThemeComponent } from '../src/host/register.ts'
import { viewsOf, type View } from '../src/host/router.ts'
import { drawView, isFramed } from '../src/host/slots.ts'

const Frame: ThemeComponent = (props) => (
  <div data-testid="frame" data-full-bleed={String(props.fullBleed)}>
    {props.children as ReactNode}
  </div>
)

/** A slot, page or route component that only says which it is. */
const drawn = (name: string): ThemeComponent => function Drawn() {
  return <p data-testid={name}>{name}</p>
}

const REGISTRATIONS: Registrations = {
  slots: new Map<string, ThemeComponent>([
    ['frame@1', Frame], ['notFound@1', drawn('not-found')], ['lookEditor@1', drawn('look-editor')], ['styleSheet@1', drawn('style-sheet')],
  ]),
  pages: new Map<string, ThemeComponent>([['/chat', drawn('chat')]]),
  routes: new Map<string, ThemeComponent>([['notes', drawn('notes')]]),
}
const VIEWS = viewsOf({ slots: ['frame@1', 'notFound@1', 'lookEditor@1', 'styleSheet@1'], pages: ['/chat'], routes: ['notes'] })
const basePage = (path: string) => <section data-testid="host-page">{path}</section>

function viewOf(key: string): View {
  const view = VIEWS.find((candidate) => candidate.key === key)
  if (view === undefined) throw new Error(`no view ${key}`)
  return view
}

function draw(key: string): void {
  render(drawView(viewOf(key), REGISTRATIONS, { basePage, autoWidget: <span>Auto</span> }))
}

describe('the 404', () => {
  it("is drawn alone, with no frame and no Auto widget, as core's not-found.tsx draws notFound@1", () => {
    draw('notFound@1')
    expect(screen.getByTestId('not-found')).toBeInTheDocument()
    expect(screen.queryByTestId('frame')).toBeNull()
    expect(screen.queryByText('Auto')).toBeNull()
    expect(isFramed(viewOf('notFound@1'))).toBe(false)
  })

  it('is the only view with no frame: every other one sits in frame@1', () => {
    expect(VIEWS.filter((view) => !isFramed(view)).map((view) => view.key)).toEqual(['notFound@1'])
    draw('/chat')
    expect(screen.getByTestId('frame')).toContainElement(screen.getByTestId('chat'))
  })
})

describe('full bleed', () => {
  it.each(['lookEditor@1', 'styleSheet@1'])("draws %s full bleed in the frame, as core's ThemeSlotPage does", (key) => {
    draw(key)
    expect(screen.getByTestId('frame')).toHaveAttribute('data-full-bleed', 'true')
  })

  it("draws a page and a route full bleed, the frame's own view and a host page in the frame's own layout", () => {
    const bleed = (view: View): string => {
      const { unmount } = render(drawView(view, REGISTRATIONS, { basePage }))
      const value = screen.getByTestId('frame').getAttribute('data-full-bleed') ?? ''
      unmount()
      return value
    }
    expect([bleed(viewOf('/chat')), bleed(viewOf('notes'))]).toEqual(['true', 'true'])
    expect(bleed(viewOf('frame@1'))).toBe('false')
    expect(bleed({ kind: 'base', key: '/agents', path: '/agents' })).toBe('false')
  })
})
