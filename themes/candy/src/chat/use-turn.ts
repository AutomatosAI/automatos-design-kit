// Copied from themes/arcade/src/chat/use-turn.ts (Arcade 1.0.0), itself from HUD 1.1.2 and Play 1.1.1: one
// conversation's chat, its parts and events played by Auto. As it is but for these lines and the theme's name.
import { type Dispatch, useCallback, useMemo, useRef } from 'react'
import {
  type HostChatController,
  type HostChatControllerOptions,
  type HostChatConversation,
  type HostChatTurnEvent,
  useChatController,
} from '@automatos/theme-sdk'

import { FAILED_TURN } from '@automatos/mascot/events'
import type { MascotEvent } from '@automatos/mascot/types'

/**
 * Candy's chat on one conversation: the SDK's useChatController(conversation) (the stream, Stop keeping the reply
 * being written, Try again, the Deliverables a turn made, a Mission suggestion, the approval cards it raised), its
 * parts and events played by Auto. Auto is driven by the chat's status, so his driver exists only after the chat:
 * `connect` hands it over in the render that makes it, so every part reaches him before the turn reads it.
 */

export interface TurnDriver {
  readonly onData: (part: unknown) => void
  readonly dispatch: Dispatch<MascotEvent>
}

export interface Turn {
  readonly chat: HostChatController
  readonly connect: (driver: TurnDriver) => void
}

/** A turn's event as Auto plays it. */
export function mascotEventOf(event: HostChatTurnEvent): MascotEvent {
  return event.type === 'turn-failed' ? { type: 'error', message: FAILED_TURN, code: event.code } : event
}

/** The conversation's chat (one the chat page's useChatController handed out); key the caller by its key. */
export function useTurn(conversation: HostChatConversation): Turn {
  const driver = useRef<TurnDriver | null>(null)
  const options = useMemo<HostChatControllerOptions>(
    () => ({
      onData: (part: unknown) => driver.current?.onData(part),
      onEvent: (event: HostChatTurnEvent) => driver.current?.dispatch(mascotEventOf(event)),
    }),
    [],
  )
  const chat = useChatController(conversation, options)
  const connect = useCallback((next: TurnDriver) => {
    driver.current = next
  }, [])
  return useMemo(() => ({ chat, connect }), [chat, connect])
}
