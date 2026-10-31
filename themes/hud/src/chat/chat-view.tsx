import { type RefObject, useCallback, useRef } from 'react'
import {
  type HostChatController,
  type HostChatConversation,
  type HostChatMessage,
  type HostHealth,
  useHealth,
  useVoice,
} from '@automatos/theme-sdk'

import { usePhoneLayout } from '../lib/phone-layout'
import { VoiceDeck } from '../voice/voice-deck'
import { briefSuggestionIds } from './briefing/brief-rows'
import { BriefingPanel } from './briefing/briefing-panel'
import type { Briefing } from './briefing/use-briefing'
import { ChatFooter } from './chat-footer'
import type { ChatParts, Sending } from './chat-parts'
import { chipWords } from './chip'
import { useBoxFill } from './composer'
import { EmptyChat } from './empty-chat'
import { useScreenLayout } from './layout'
import { PhoneChat } from './phone/phone-chat'
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
 * approval card waits, asleep while the backend is down or after a long while without input. The state chip says it
 * in words, or, while the host's voice session listens, thinks or speaks, that (chip.ts). Before anything is said, the
 * empty chat's starters put their words in the message box.
 *
 * Voice is beside the box, never instead of it: the host's voice button in the design's waveform over the message box
 * (src/voice/voice-deck.tsx). While a voice session runs on the conversation, the host puts what was heard and what
 * Auto is saying at the end of its messages (voice-live-user and voice-live-assistant), so the transcript shows them as
 * a YOU and an AUTO row like any others, until the saved turn takes their place.
 *
 * In a window narrower than the desktop layout (src/lib/phone-layout.ts) the same chat is drawn as the design's phone
 * (phone/phone-chat.tsx); everything above is made once for both, so a window crossing the width keeps it.
 *
 * HUD 1.2.0 (PRD-268): while the day's brief shows (the page's useBriefing), BRIEFING stands where the screen places
 * it (screen.tsx; on a phone, the last exchange's place), until it folds back.
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
  /** The day's brief while BRIEFING shows, held by the page across conversations. */
  readonly briefing: Briefing
}

interface ChatWithAutoProps {
  readonly turn: HudTurn
  readonly idleMs?: number
  readonly briefing: Briefing
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
export function HudChatView({ conversation, idleMs, briefing }: HudChatViewProps) {
  const turn = useHudTurn(conversation)
  return <ChatWithAuto turn={turn} idleMs={idleMs} briefing={briefing} />
}

function ChatWithAuto({ turn, idleMs, briefing }: ChatWithAutoProps) {
  const { chat } = turn
  // The conversation as the chat hook holds it: Auto, the chip and the turn's end read this one.
  const live = liveMessages(chat.messages)
  const auto = useChatAuto(turn, live, idleMs)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const sending = useSending(chat, auto, boxRef)
  const { fill, fillBox } = useBoxFill()
  const phone = usePhoneLayout()
  const { phase: voicePhase } = useVoice()
  const reply = latestReply(live)
  const chip = chipWords(auto.mascot, {
    runningInput: runningToolInput(reply),
    deliverableKind: newestKind(reply),
    backendDown: auto.state.backendDown,
    approvalWaiting: auto.state.approvalWaiting,
    voicePhase,
  })
  const parts: ChatParts = { chat, live, auto, chip, sending, boxRef, fill, fillBox, briefing }
  return phone ? <PhoneChat {...parts} /> : <DesktopChat {...parts} />
}

/** The desktop's core screen: the conversation's column between the side panels, laid out by its measured size. */
function DesktopChat({ chat, live, auto, chip, sending, boxRef, fill, fillBox, briefing }: ChatParts) {
  const { ref, layout } = useScreenLayout()
  const core = <VoiceCore state={auto.mascot} chip={chip} size={layout.core} onClipEnded={auto.onClipEnded} />
  const autoFocus = chat.messages.length === 0
  // BRIEFING is on screen unless, at one column, a card waiting for you keeps the transcript in its slot.
  const listed = briefSuggestionIds(layout.columns === 'one' && chat.approvalWaiting ? null : briefing.brief)
  const voice = <VoiceDeck />
  const footer = <ChatFooter chat={chat} boxRef={boxRef} sending={sending} autoFocus={autoFocus} fill={fill} voice={voice} listed={listed} />
  const missionId = chat.planningMissionId
  const brief = briefing.brief === null ? null : <BriefingPanel brief={briefing.brief} onFold={briefing.fold} />
  return (
    <ChatScreen
      screenRef={ref}
      layout={layout}
      title={chat.title}
      core={core}
      footer={footer}
      missionId={missionId}
      briefing={brief}
      keepTranscript={chat.approvalWaiting}
    >
      <Transcript
        messages={chat.messages}
        streaming={chat.streaming}
        onRetry={sending.retry}
        trialBlocked={chat.trialExhausted}
        after={<TurnEnd chat={chat} messages={live} onRetry={sending.retry} />}
        empty={<EmptyChat onStarter={fillBox} />}
      />
    </ChatScreen>
  )
}
