'use client'

import { type RefObject, useCallback } from 'react'
import type { HostChatController, HostChatDraft } from '@automatos/theme-sdk'

import { useAgentSeat } from './agent-picker'
import { MessageBox } from './message-box'
import { ModeRow } from './mode-row'

/**
 * Play 1.5.0: the message box (message-box.tsx) with the row under it (mode-row.tsx): the agent picker
 * (agent-picker.tsx), which also names the box after the agent it talks to (choosing one gives the box the focus), then
 * Code, Plan and Mission. On a desktop and a phone alike. The box is keyed by its
 * fill, as before: a new serial is a fresh box with the fill's words, focused.
 */

export interface PlayComposerProps {
  readonly chat: HostChatController
  /** The message box, which Try again and a chosen agent focus. */
  readonly box: RefObject<HTMLTextAreaElement | null>
  /** Words for a fresh box (an example chip's, a link's draft); null for none. */
  readonly fill: HostChatDraft | null
  readonly onStop: () => void
  readonly onFocus: () => void
  readonly onBlur: () => void
  readonly autoFocus: boolean
  /** The voice button's hotkey: VOICE_HOTKEY on a desktop, null on a phone. */
  readonly voiceHotkey: string | null
}

export function PlayComposer({ chat, box, fill, onStop, onFocus, onBlur, autoFocus, voiceHotkey }: PlayComposerProps) {
  const focusBox = useCallback(() => box.current?.focus(), [box])
  const seat = useAgentSeat(chat, focusBox)
  return (
    <>
      <MessageBox
        ref={box}
        key={fill ? `fill-${fill.serial}` : 'box'}
        streaming={chat.streaming}
        onSend={chat.send}
        onStop={onStop}
        onFocus={onFocus}
        onBlur={onBlur}
        initialDraft={fill?.text}
        autoFocus={autoFocus}
        voiceHotkey={voiceHotkey}
        placeholder={seat.placeholder}
      />
      <ModeRow plan={chat} agent={seat.picker} />
    </>
  )
}
