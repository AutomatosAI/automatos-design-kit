import { lazy, Suspense } from 'react'

/**
 * HUD's own route `conversations` (theme.json's "routes", served by the host at /x/conversations): the Conversations
 * page (src/conversations/conversations-screen.tsx). It loads in its own chunk when it first renders (React.lazy),
 * behind a boundary that draws nothing meanwhile, so the entry holds only the frame and the slots.
 */

const ConversationsPage = lazy(() =>
  import('../conversations/conversations-screen').then((loaded) => ({ default: loaded.HudConversations })),
)

export function HudConversationsRoute() {
  return (
    <Suspense fallback={null}>
      <ConversationsPage />
    </Suspense>
  )
}
