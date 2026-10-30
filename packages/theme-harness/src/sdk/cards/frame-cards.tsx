/**
 * PRD-261 B-02c: stand-ins for SDK cards AiLabelFence and CorePage. They mirror core's
 * frontend/lib/theme-sdk/host-cards/ai-label-fence.tsx (at 3d8c72e7b58d32866f058a171d68bbbb8a335504) and
 * core-page.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac).
 *
 * AiLabelFence was the host's AI label fence; since core #1365 (PRD-264 EUAI-11a) it is its children and nothing
 * else: no theme can hide the host's AI label (the host draws a hidden one again in its own layer), so no composer
 * waits on it. It disables nothing and draws no element; `label` and `held` are taken and change nothing. CorePage
 * shows its children, as core's does where there is no core page, and the harness has none. Its root carries
 * data-protected-surface and lays out as its children would (display: contents).
 */
import type { CSSProperties } from 'react'

type Sdk = typeof import('@automatos/theme-sdk')

const NO_LAYOUT: CSSProperties = Object.freeze({ display: 'contents' })

/** cards.AiLabelFence: a theme's composer as it is; the host's AI label is never hidden, so nothing here is disabled. */
export const AiLabelFence: Sdk['AiLabelFence'] = function AiLabelFence({ children }) {
  return <>{children}</>
}

/** cards.CorePage: the children, where there is no core page (always, in the harness). */
export const CorePage: Sdk['CorePage'] = function CorePage({ children }) {
  return (
    <div data-protected-surface="core-page" style={NO_LAYOUT}>
      {children}
    </div>
  )
}
