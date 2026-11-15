import { type ReactNode, type RefObject, useCallback } from 'react'
import { type HostChatController, type HostChatDraft, TrialExhaustedBanner, useTrial } from '@automatos/theme-sdk'

import cards from './cards.module.css'
import { Composer } from './composer'
import { useAgentSeat } from './modes/agent-picker'
import { ModeRow } from './modes/mode-row'
import { NextLine } from './next/next-line'

/**
 * What sits under the transcript: the host's banner for used-up credits (work on the platform's AI keys is paused:
 * the workspace's credits say so, or the last send was refused with the typed credits_exhausted code), the voice deck
 * (src/voice/voice-deck.tsx: the waveform with the host's voice button), and the message box. The banner is the host's
 * own card; HUD only places it. The host's first-run nudge heads the column instead (screen.tsx), clear of the box.
 * HUD 1.2.0 (PRD-268): the `▸ NEXT` line, what Auto suggests, sits between the banner and the voice deck
 * (next/next-line.tsx). HUD 1.4.0: the message box carries the row of CODE, PLAN and MISSION under it, with the agent
 * picker first (modes/), which also names the box after the agent it talks to.
 */

const EXHAUSTED = 'exhausted'

export interface ChatSending {
  readonly send: (text: string) => boolean
  readonly onStop: () => void
}

export interface ChatFooterProps {
  readonly chat: HostChatController
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  readonly sending: ChatSending
  /** Focus the box as it appears (a new chat). */
  readonly autoFocus: boolean
  /** Words for the box (an empty chat's starter). */
  readonly fill?: HostChatDraft | null
  /** Over the message box: the voice deck. */
  readonly voice?: ReactNode
  /** The suggestions BRIEFING on screen lists, which the NEXT line skips. */
  readonly listed?: readonly string[]
}

/** The host's banner for used-up credits, while they are; the phone's screen places it over its controls. */
export function TrialBanner({ errorCode, trialExhausted }: { readonly errorCode: string | null; readonly trialExhausted: boolean }) {
  const exhausted = useTrial()?.state === EXHAUSTED || trialExhausted
  if (!exhausted) return null
  return (
    <div className={cards.hostCard}>
      <TrialExhaustedBanner errorCode={errorCode} />
    </div>
  )
}

export function ChatFooter({ chat, boxRef, sending, autoFocus, fill = null, voice = null, listed }: ChatFooterProps) {
  const focusBox = useCallback(() => boxRef.current?.focus(), [boxRef])
  const seat = useAgentSeat(chat, focusBox)
  return (
    <>
      <TrialBanner errorCode={chat.errorCode} trialExhausted={chat.trialExhausted} />
      <NextLine place="footer" listed={listed} />
      {voice}
      <Composer
        boxRef={boxRef}
        streaming={chat.streaming}
        onSend={sending.send}
        onStop={sending.onStop}
        autoFocus={autoFocus}
        fill={fill}
        placeholder={seat.placeholder}
        tools={<ModeRow plan={chat} agent={seat.picker} />}
      />
    </>
  )
}
