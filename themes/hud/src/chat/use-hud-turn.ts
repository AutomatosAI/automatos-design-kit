// After themes/play/src/hooks/use-play-turn.ts (Play 1.1.1), its names HUD's: one conversation's chat, its parts
// and events played by Auto.
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
 * HUD's chat on one conversation: the SDK's useChatController(conversation) (the stream, Stop keeping the reply
 * being written, Try again, the Deliverables a turn made, a Mission suggestion, a reply that failed in words, the
 * approval cards it raised), its parts and events played by Auto: a Deliverable is new (deliverable-added), a card
 * waits and none does any more (approval-waiting, approval-settled), and a reply that failed in words is oops even
 * when the stream ended in the same render (error).
 *
 * Auto is driven by the chat's status, so his driver exists only after the chat: `connect` hands it over, in the
 * render that makes the driver, so each part reaches Auto before the turn reads it and a card still waiting when
 * the screen mounts again is announced in its first effects.
 */

/** What HUD's chat drives with the turn: Auto (useHudAuto's onData and dispatch). */
export interface HudTurnDriver {
  /** Each data part of the stream, before the turn reads it. */
  readonly onData: (part: unknown) => void
  /** Auto's events. */
  readonly dispatch: Dispatch<MascotEvent>
}

export interface HudTurn {
  /** The conversation's chat as the SDK's view. */
  readonly chat: HostChatController
  /** Auto, once he exists; the parts and events from then on go to him. */
  readonly connect: (driver: HudTurnDriver) => void
}

/** A turn's event as Auto plays it. */
export function mascotEventOf(event: HostChatTurnEvent): MascotEvent {
  return event.type === 'turn-failed' ? { type: 'error', message: FAILED_TURN, code: event.code } : event
}

/** The conversation's chat (one the chat page's useChatController handed out); key the caller by `conversation.key`. */
export function useHudTurn(conversation: HostChatConversation): HudTurn {
  const driver = useRef<HudTurnDriver | null>(null)
  const options = useMemo<HostChatControllerOptions>(
    () => ({
      onData: (part: unknown) => driver.current?.onData(part),
      onEvent: (event: HostChatTurnEvent) => driver.current?.dispatch(mascotEventOf(event)),
    }),
    [],
  )
  const chat = useChatController(conversation, options)
  const connect = useCallback((next: HudTurnDriver) => {
    driver.current = next
  }, [])
  return useMemo(() => ({ chat, connect }), [chat, connect])
}
