/**
 * PRD-261 B-02c: stand-ins for SDK cards AiLabelFence and CorePage. They mirror core's
 * frontend/lib/theme-sdk/host-cards/ai-label-fence.tsx and core-page.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac).
 *
 * AiLabelFence is a <fieldset> that draws no box, disabled (and every control in it) while the host's AI label is
 * off screen (setAiLabelShown, PRD-264 EUAI-11a); the harness's label is checked at once, so `held` changes
 * nothing here. CorePage shows its children, as core's does where there is no core page, and the harness has none.
 * Each root carries data-protected-surface; CorePage's lays out as its children would (display: contents).
 */
import type { CSSProperties } from 'react'
import { useAiLabelShown } from '../../internal/scripted/chat-script.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** The page's label, beside every in-app chat (the default of `label`). */
const PAGE_LABEL = 'page'
/** A fieldset with no box of its own, laid out as its children alone, as core draws the fence (`display: contents`). */
const NO_BOX: CSSProperties = Object.freeze({ display: 'contents', border: 0, margin: 0, padding: 0, minWidth: 0 })
const NO_LAYOUT: CSSProperties = Object.freeze({ display: 'contents' })

/** cards.AiLabelFence: the composer, disabled while the AI label beside it can't be seen. */
export const AiLabelFence: Sdk['AiLabelFence'] = function AiLabelFence({ children, label = PAGE_LABEL }) {
  const shown = useAiLabelShown()
  return (
    <fieldset data-protected-surface="ai-label-fence" data-label={label} disabled={!shown} style={NO_BOX}>
      {children}
    </fieldset>
  )
}

/** cards.CorePage: the children, where there is no core page (always, in the harness). */
export const CorePage: Sdk['CorePage'] = function CorePage({ children }) {
  return (
    <div data-protected-surface="core-page" style={NO_LAYOUT}>
      {children}
    </div>
  )
}
