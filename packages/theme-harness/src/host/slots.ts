/**
 * PRD-261 B-02e: a view as the host draws it under the theme, at or above the theme's minWidth: the theme's frame@1
 * around the view's content, as core's MainLayout draws its chrome around a page (the frame's props: the page as
 * children, `fullBleed` for a page or route the theme owns and for the looks pages, which it draws edge to edge, and
 * the host's Auto widget). The looks pages (lookEditor@1 on /looks, styleSheet@1 on /looks/style) are full bleed as
 * core's components/theme-host/theme-slot-page.tsx:66 draws them: `<MainLayout fullBleed>` around the slot's screen.
 * The content is the theme's slot, page or route component for the view; the frame's own view and every path the
 * theme draws nothing for are the host's own page inside the frame (`basePage`). The 404 (notFound@1) is the one view
 * with no frame: core's frontend/app/not-found.tsx draws it through ThemeSlot as a slot, which
 * components/theme-host/theme-slot.tsx (ThemeNamedSlot) renders unframed, outside MainLayout. Below minWidth, or once
 * the theme failed, the app draws the host's page alone instead (app/host.tsx).
 */
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { Registrations, ThemeComponent } from './register.ts'
import { FRAME_SLOT, type View } from './router.ts'

export interface DrawOptions {
  /** The host's own page for a path, drawn inside the frame. */
  readonly basePage: (path: string) => ReactElement
  /** What the host hands the frame as its Auto widget. */
  readonly autoWidget?: ReactNode
}

/** The theme's component for a view; null for the frame's own view and a path the theme draws nothing for. */
export function viewComponent(view: View, registrations: Registrations): ThemeComponent | null {
  if (view.kind === 'page') return registrations.pages.get(view.key) ?? null
  if (view.kind === 'route') return registrations.routes.get(view.key) ?? null
  if (view.kind === 'slot' && view.key !== FRAME_SLOT) return registrations.slots.get(view.key) ?? null
  return null
}

/** The slots core draws with no frame around them (not-found.tsx's ThemeSlot, framed false in theme-slot.tsx). */
const UNFRAMED_SLOTS: ReadonlySet<string> = new Set(['notFound@1'])

/** False for a view core draws alone, outside the theme's frame: the 404. */
export function isFramed(view: View): boolean {
  return !(view.kind === 'slot' && UNFRAMED_SLOTS.has(view.key))
}

/** The slots core draws as a page of their own, full bleed in MainLayout (theme-slot-page.tsx, ThemeSlotPage). */
const FULL_BLEED_SLOTS: ReadonlySet<string> = new Set(['lookEditor@1', 'styleSheet@1'])

/**
 * A page or route the theme owns, and the looks pages, are drawn full bleed; any other slot and the host's pages sit
 * in the frame's own layout.
 */
export function isFullBleed(view: View): boolean {
  if (view.kind === 'slot') return FULL_BLEED_SLOTS.has(view.key)
  return view.kind === 'page' || view.kind === 'route'
}

/** The view inside the theme's frame; the 404 alone, with no frame and no Auto widget, as core draws it. */
export function drawView(view: View, registrations: Registrations, options: DrawOptions): ReactElement {
  const frame = registrations.slots.get(FRAME_SLOT)
  if (frame === undefined) throw new Error(`the theme registered no "${FRAME_SLOT}" component`)
  const component = viewComponent(view, registrations)
  const content = component === null ? options.basePage(view.path) : createElement(component, { key: view.path })
  if (component !== null && !isFramed(view)) return content
  return createElement(frame, { fullBleed: isFullBleed(view), autoWidget: options.autoWidget }, content)
}
