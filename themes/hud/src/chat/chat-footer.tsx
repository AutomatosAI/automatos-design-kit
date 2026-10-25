import type { RefObject } from 'react'
import { type HostChatController, type HostChatDraft, TrialExhaustedBanner, useTrial } from '@automatos/theme-sdk'

import cards from './cards.module.css'
import { Composer } from './composer'

/**
 * What sits under the transcript: the host's banner for used-up credits (work on the platform's AI keys is paused:
 * the workspace's credits say so, or the last send was refused with the typed credits_exhausted code), and the
 * message box. The banner is the host's own card; HUD only places it. The host's first-run nudge heads the column
 * instead (screen.tsx), clear of the box.
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
}

function TrialBanner({ errorCode, trialExhausted }: { readonly errorCode: string | null; readonly trialExhausted: boolean }) {
  const exhausted = useTrial()?.state === EXHAUSTED || trialExhausted
  if (!exhausted) return null
  return (
    <div className={cards.hostCard}>
      <TrialExhaustedBanner errorCode={errorCode} />
    </div>
  )
}

export function ChatFooter({ chat, boxRef, sending, autoFocus, fill = null }: ChatFooterProps) {
  return (
    <>
      <TrialBanner errorCode={chat.errorCode} trialExhausted={chat.trialExhausted} />
      <Composer
        boxRef={boxRef}
        streaming={chat.streaming}
        onSend={sending.send}
        onStop={sending.onStop}
        autoFocus={autoFocus}
        fill={fill}
      />
    </>
  )
}
