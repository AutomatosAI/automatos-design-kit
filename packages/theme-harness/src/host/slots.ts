/**
 * PRD-261 B-02e: a view as the host draws it under the theme, at or above the theme's minWidth: the theme's frame@1
 * around the view's content, as core's MainLayout draws its chrome around a page (the frame's props: the page as
 * children, `fullBleed` for a page or route the theme owns, which it draws edge to edge, and the host's Auto widget).
 * The content is the theme's slot, page or route component for the view; the frame's own view and every path the
 * theme draws nothing for are the host's own page inside the frame (`basePage`). Below minWidth, or once the theme
 * failed, the app draws the host's page alone instead (app/host.tsx).
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

/** A page or route the theme owns is drawn full bleed; a slot and the host's pages sit in the frame's own layout. */
export function isFullBleed(view: View): boolean {
  return view.kind === 'page' || view.kind === 'route'
}

/** The view inside the theme's frame. */
export function drawView(view: View, registrations: Registrations, options: DrawOptions): ReactElement {
  const frame = registrations.slots.get(FRAME_SLOT)
  if (frame === undefined) throw new Error(`the theme registered no "${FRAME_SLOT}" component`)
  const component = viewComponent(view, registrations)
  const content = component === null ? options.basePage(view.path) : createElement(component, { key: view.path })
  return createElement(frame, { fullBleed: isFullBleed(view), autoWidget: options.autoWidget }, content)
}
