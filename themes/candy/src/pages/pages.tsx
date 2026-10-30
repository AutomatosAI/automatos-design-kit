import { lazy, Suspense } from 'react'

/**
 * The pages Candy owns (theme.json "pages" and "routes"): /chat, /deliverables, /x/today and /x/agents. Each loads in
 * its own chunk the first time it renders (React.lazy), behind a boundary that draws nothing meanwhile, so the entry
 * holds only the frame and the slots and the frame paints first.
 */

const Chat = lazy(() => import('../chat/chat-page').then((loaded) => ({ default: loaded.ChatPage })))
const Deliverables = lazy(() => import('../deliverables/deliverables-page').then((loaded) => ({ default: loaded.DeliverablesPage })))
const Today = lazy(() => import('../today/today-page').then((loaded) => ({ default: loaded.TodayPage })))
const Agents = lazy(() => import('../agents/agents-page').then((loaded) => ({ default: loaded.AgentsPage })))

export function ChatRoute() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  )
}

export function DeliverablesRoute() {
  return (
    <Suspense fallback={null}>
      <Deliverables />
    </Suspense>
  )
}

export function TodayRoute() {
  return (
    <Suspense fallback={null}>
      <Today />
    </Suspense>
  )
}

export function AgentsRoute() {
  return (
    <Suspense fallback={null}>
      <Agents />
    </Suspense>
  )
}
