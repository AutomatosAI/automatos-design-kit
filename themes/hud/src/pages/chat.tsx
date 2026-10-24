import { lazy, Suspense } from 'react'

/**
 * The page HUD owns at /chat (theme.json's "pages"): the core screen (src/chat/hud-chat.tsx). It loads in its own
 * chunk when it first renders (React.lazy), behind a boundary that draws nothing meanwhile, so the entry holds only
 * the frame and the slots; the host draws the page full bleed inside HUD's frame.
 */

const CoreScreen = lazy(() => import('../chat/hud-chat').then((loaded) => ({ default: loaded.HudChatPage })))

export function HudChat() {
  return (
    <Suspense fallback={null}>
      <CoreScreen />
    </Suspense>
  )
}
