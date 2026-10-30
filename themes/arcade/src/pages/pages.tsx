import { lazy, Suspense } from 'react'

/**
 * The pages Arcade owns (theme.json "pages" and "routes"): /chat, /deliverables (the Inventory) and /x/quests. Each
 * loads in its own chunk the first time it renders (React.lazy), behind a boundary that draws nothing meanwhile, so
 * the entry holds only the frame and the slots and the frame paints first.
 */

const Chat = lazy(() => import('../chat/chat-page').then((loaded) => ({ default: loaded.ChatPage })))
const Inventory = lazy(() => import('../deliverables/inventory-page').then((loaded) => ({ default: loaded.InventoryPage })))
const Quests = lazy(() => import('../quests/quests-page').then((loaded) => ({ default: loaded.QuestsPage })))

export function ChatRoute() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  )
}

export function InventoryRoute() {
  return (
    <Suspense fallback={null}>
      <Inventory />
    </Suspense>
  )
}

export function QuestsRoute() {
  return (
    <Suspense fallback={null}>
      <Quests />
    </Suspense>
  )
}
