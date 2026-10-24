import { type RefObject, useCallback, useRef } from 'react'
import {
  type HostChatController,
  type HostChatConversation,
  type HostChatMessage,
  type HostHealth,
  useHealth,
} from '@automatos/theme-sdk'

import { ChatFooter, type ChatSending } from './chat-footer'
import { chipWords } from './chip'
import { useScreenLayout } from './layout'
import { latestReply, liveMessages, replyProgress, runningToolInput } from './reply'
import { ChatScreen } from './screen'
import { Transcript } from './transcript'
import { TurnEnd } from './turn-end'
import { type BackendStatus, type HudAutoDriver, useHudAuto } from './use-hud-auto'
import { type HudTurn, useHudTurn } from './use-hud-turn'
import { VoiceCore } from './voice-core'

/**
 * One conversation on the core screen: the host's chat for it (use-hud-turn.ts, the SDK's chat controller:
 * sending and streaming, Stop keeping the reply being written, Try again, the turn's cards), Auto on the core
 * driven by it (use-hud-auto.ts), the transcript, and the message box. Auto's state is the turn's, as
 * Mascot.dc.html maps it: thinking once you send, searching, reading or working while a tool runs, back at rest
 * when his words start, celebrating a done receipt or a new Deliverable, oops on a failure, listening while an
 * approval card waits, asleep while the backend is down or after a long while without input.
 *
 * Two components, so Auto hears the chat in order: the chat in HudChatView, Auto and the screen in its child,
 * whose effects (Auto reading the status and the reply) run before the turn's own (a failure, a card waiting or
 * settled) in every commit.
 */

export interface HudChatViewProps {
  /** The conversation on screen, as the chat page's useChatController hands it out; key the view by its key. */
  readonly conversation: HostChatConversation
  /** How long without input before Auto naps (tests shorten it). */
  readonly idleMs?: number
}

interface ChatWithAutoProps {
  readonly turn: HudTurn
  readonly idleMs?: number
}

const BACKEND_OF: Readonly<Record<HostHealth['connection'], BackendStatus | undefined>> = {
  connected: 'up',
  down: 'down',
  checking: undefined,
}

/** Auto, driven by the chat's status and the reply being written, and connected to the chat's parts and events. */
function useChatAuto({ chat, connect }: HudTurn, live: readonly HostChatMessage[], idleMs: number | undefined): HudAutoDriver {
  const { connection } = useHealth()
  const auto = useHudAuto({ status: chat.status, errorCode: chat.errorCode, reply: replyProgress(live), backend: BACKEND_OF[connection], idleMs })
  // In the render that makes the driver, before any effect of this commit (use-hud-turn.ts).
  connect(auto)
  return auto
}

/** The newest reply's newest Deliverable's kind, for the chip's "Your document is ready". */
function newestKind(reply: HostChatMessage | undefined): string | undefined {
  const made = reply?.deliverables ?? []
  return made[made.length - 1]?.kind
}

interface Sending extends ChatSending {
  readonly retry: () => void
}

/**
 * Send, Try again and Stop, each leaving the focus in the message box (a Send or Stop button that gives way to the
 * other would drop it to the page). Stop tells Auto first (a done receipt no longer celebrates the stopped turn),
 * then runs the chat's stop, which keeps the reply being written and stops the turn.
 */
function useSending(chat: HostChatController, auto: HudAutoDriver, box: RefObject<HTMLTextAreaElement | null>): Sending {
  const { send: sendWords, retry: askAgain, stop } = chat
  const { dispatch } = auto
  const focusBox = useCallback(() => box.current?.focus(), [box])
  const send = useCallback((text: string): boolean => {
    const sent = sendWords(text)
    if (sent) focusBox()
    return sent
  }, [sendWords, focusBox])
  const retry = useCallback(() => {
    if (askAgain()) focusBox()
  }, [askAgain, focusBox])
  const onStop = useCallback(() => {
    dispatch({ type: 'stop' })
    stop()
    focusBox()
  }, [dispatch, stop, focusBox])
  return { send, retry, onStop }
}

/** The conversation's chat; Auto and the screen in the child (see above). */
export function HudChatView({ conversation, idleMs }: HudChatViewProps) {
  const turn = useHudTurn(conversation)
  return <ChatWithAuto turn={turn} idleMs={idleMs} />
}

function ChatWithAuto({ turn, idleMs }: ChatWithAutoProps) {
  const { chat } = turn
  // The conversation as the chat hook holds it: Auto, the chip and the turn's end read this one.
  const live = liveMessages(chat.messages)
  const auto = useChatAuto(turn, live, idleMs)
  const box = useRef<HTMLTextAreaElement>(null)
  const sending = useSending(chat, auto, box)
  const { ref, layout } = useScreenLayout()
  const reply = latestReply(live)
  const chip = chipWords(auto.mascot, {
    runningInput: runningToolInput(reply),
    deliverableKind: newestKind(reply),
    backendDown: auto.state.backendDown,
    approvalWaiting: auto.state.approvalWaiting,
  })
  const core = <VoiceCore state={auto.mascot} chip={chip} size={layout.core} onClipEnded={auto.onClipEnded} />
  const footer = <ChatFooter chat={chat} boxRef={box} sending={sending} autoFocus={chat.messages.length === 0} />
  return (
    <ChatScreen screenRef={ref} layout={layout} title={chat.title} core={core} footer={footer}>
      <Transcript
        messages={chat.messages}
        streaming={chat.streaming}
        onRetry={sending.retry}
        trialBlocked={chat.trialExhausted}
        after={<TurnEnd chat={chat} messages={live} onRetry={sending.retry} />}
      />
    </ChatScreen>
  )
}
