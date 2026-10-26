'use client'

import type { HostChatMessage } from '@automatos/theme-sdk'

import type { AutoMascotDriver } from '../../../hooks/use-auto-mascot'
import { usePlayVoice } from '../../../hooks/use-play-voice'
import type { VoiceWords } from '../../../lib/voice/voice-pose'
import type { MascotName } from '@automatos/mascot/types'

import { type ChatCaption, chatCaption } from './caption'
import { latestReply, runningToolInput } from './reply'

/**
 * Play 1.2.0 — the Auto the chat shows: the chat's (his reducer's state and the caption the chat gives it,
 * caption.ts), or, while the host's voice session runs, the session's (lib/voice/voice-pose.ts), so he listens while
 * the microphone is open, thinks, and speaks with his ring following his voice. When the session ends the chat
 * drives him again, where it left him. The words the session heard and spoke come with it (voice-words.tsx).
 */

export interface AutoOnScreen {
  /** AutoMascot's state. */
  readonly state: MascotName
  /** His caption and its second line. */
  readonly caption: ChatCaption
  /** Auto speaks through the host's voice: his ring follows his voice. */
  readonly speaking: boolean
  /** A voice session drives him (its caption shows even where the first open's headline would say it). */
  readonly voiceActive: boolean
  readonly words: VoiceWords | null
}

/** The newest reply's newest live Deliverable's kind, for the caption's "It's on your shelf too." */
function newestKind(reply: HostChatMessage | undefined): string | undefined {
  const made = reply?.deliverables ?? []
  return made[made.length - 1]?.kind
}

/** The caption the chat gives Auto's state: the running tool's input, a Deliverable's kind, a nap, a card waiting. */
function chatCaptionOf(auto: AutoMascotDriver, live: readonly HostChatMessage[]): ChatCaption {
  const reply = latestReply(live)
  return chatCaption(auto.mascot, {
    runningInput: runningToolInput(reply),
    deliverableKind: newestKind(reply),
    backendDown: auto.state.backendDown,
    approvalWaiting: auto.state.approvalWaiting,
  })
}

export function useAutoOnScreen(auto: AutoMascotDriver, live: readonly HostChatMessage[]): AutoOnScreen {
  const { pose, words } = usePlayVoice()
  if (pose === null) {
    return { state: auto.mascot, caption: chatCaptionOf(auto, live), speaking: false, voiceActive: false, words }
  }
  return { state: pose.mascot, caption: { caption: pose.caption }, speaking: pose.speaking, voiceActive: true, words }
}
