/**
 * What Play hands the host, as core's builtin Play registers it (frontend/lib/theme-host/builtin/
 * play-slots.tsx): its frame, its chat and Deliverables pages, its look editor, style sheet and 404,
 * and its Conversations route.
 *
 * The frame is in the entry chunk, so it draws on the first render the host gives it. Every screen
 * loads in its own chunk when it first renders (React.lazy, in place of core's next/dynamic), behind
 * a boundary that draws nothing meanwhile, as next/dynamic did. An installed theme's page is its
 * content only: the host draws it full bleed inside the frame, so these pages draw no layout of
 * their own (core's builtin pages wrap MainLayout themselves).
 */
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'

import { PlayFrame } from './components/play/shell/play-frame'

export { PlayConversations } from './components/play/conversations/play-conversations-lazy'

/** Play's route for its Conversations page, served at /x/conversations. */
export const PLAY_CONVERSATIONS_ROUTE = 'conversations'

/** frame@1's props: the host's full-bleed flag and Auto's widget, around the page. */
export interface FrameSlotProps {
  readonly children?: ReactNode
  readonly fullBleed?: boolean
  readonly autoWidget?: ReactNode
}

/** frame@1: Play's frame around the page. */
export function PlayFrameSlot({ children, fullBleed, autoWidget }: FrameSlotProps) {
  return (
    <PlayFrame fullBleed={fullBleed} autoWidget={autoWidget}>
      {children}
    </PlayFrame>
  )
}

/** A screen that loads its own chunk on its first render and draws nothing until it has. */
function lazyScreen(load: () => Promise<{ default: ComponentType }>, name: string): ComponentType {
  const Screen = lazy(load)
  function LazyScreen() {
    return (
      <Suspense fallback={null}>
        <Screen />
      </Suspense>
    )
  }
  LazyScreen.displayName = name
  return LazyScreen
}

export const PlayChat = lazyScreen(
  () => import('./components/play/chat/play-chat').then((m) => ({ default: m.PlayChat })),
  'PlayChat',
)

export const PlayShelf = lazyScreen(
  () => import('./components/play/deliverables/play-shelf').then((m) => ({ default: m.PlayShelf })),
  'PlayShelf',
)

export const LooksScreen = lazyScreen(
  () => import('./components/looks/looks-screen').then((m) => ({ default: m.LooksScreen })),
  'LooksScreen',
)

export const StyleScreen = lazyScreen(
  () => import('./components/looks/style/style-screen').then((m) => ({ default: m.StyleScreen })),
  'StyleScreen',
)

export const LostScreen = lazyScreen(
  () => import('./components/play/edges/lost-screen').then((m) => ({ default: m.LostScreen })),
  'LostScreen',
)
