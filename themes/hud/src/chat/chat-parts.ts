import type { RefObject } from 'react'
import type { HostChatController, HostChatDraft, HostChatMessage } from '@automatos/theme-sdk'

import type { Briefing } from './briefing/use-briefing'
import type { ChatSending } from './chat-footer'
import type { HudAutoDriver } from './use-hud-auto'

/**
 * What the core screen draws one conversation from, on the desktop and on a phone alike (chat-view.tsx makes it once,
 * so a window crossing the phone's width keeps the chat, Auto and the box's words where they live).
 */

/** Send, Stop and Try again, each leaving the focus in the message box. */
export interface Sending extends ChatSending {
  readonly retry: () => void
}

export interface ChatParts {
  /** The conversation's chat, as the SDK's view. */
  readonly chat: HostChatController
  /** The conversation as the chat hook holds it (reply.ts liveMessages). */
  readonly live: readonly HostChatMessage[]
  /** Auto, driven by the chat. */
  readonly auto: HudAutoDriver
  /** Auto's state in words, for the chip under the core (chip.ts). */
  readonly chip: string
  readonly sending: Sending
  /** The message box, which Send, Stop and Try again focus. */
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  /** Words for the message box (an empty chat's starter). */
  readonly fill: HostChatDraft | null
  /** Puts a starter's words in the message box. */
  readonly fillBox: (text: string) => void
  /** The day's brief while BRIEFING shows, and its fold (HUD 1.2.0, briefing/use-briefing.ts). */
  readonly briefing: Briefing
}
