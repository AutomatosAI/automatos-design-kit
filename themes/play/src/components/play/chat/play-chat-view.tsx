'use client'

import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import {
  type Brief,
  type HostChatController,
  type HostChatConversation,
  type HostChatDraft,
  type HostChatMessage,
  type HostHealth,
  useHealth,
} from '@automatos/theme-sdk'

import { type AutoMascotDriver, type BackendStatus, useAutoMascot } from '../../../hooks/use-auto-mascot'
import { type PlayProactive, useCalibrationHello, usePlayProactive } from '../../../hooks/use-play-proactive'
import { type PlayTurn, usePlayTurn } from '../../../hooks/use-play-turn'
import { usePhoneLayout } from '../../../lib/play/phone-layout'
import { briefOnScreen, briefSuggestionIds, missionSuggestionOpen } from '../../../lib/play/proactive'
import { AutoMascot } from '../../mascot/auto-mascot'
import { OpeningCards } from '../proactive/opening-cards'
import { PlayPinnedSuggestion } from '../proactive/pinned-suggestion'
import { MascotColumn, PageColumns, PageHeader } from '../shell/page-columns'

import { LooseApprovalCards } from './approval-cards'
import { ExampleChips, FirstOpenHero } from './first-open'
import { MessageBox, VOICE_HOTKEY } from './message-box'
import { MessageList } from './message-list'
import { liveMessages, replyProgress } from './reply'
import { PlayTrialBanner, TurnEnd } from './turn-end'
import { type AutoOnScreen, useAutoOnScreen } from './use-auto-on-screen'
import styles from './composer.module.css'

/**
 * PRD-260 §4, D5, D6 — the chat with Auto (mocks 01, 02 and 06), ported from
 * Automatos Play's components/chat/ChatView.tsx onto the core's data, through
 * the theme SDK (PRD-261 A-14a): the conversation's chat is usePlayTurn's, the
 * SDK's useChatController(conversation) on the chat controller (sending and
 * streaming through useChatWithReceipts, the hook chat.tsx uses; a new chat's
 * id into the session store as chat.tsx does; Stop keeping the reply Auto was
 * writing, as stopped, P260-FX-30, and cancelling the turn on the server; Try
 * again; a turn's Deliverables, Mission suggestion, failure and approval cards
 * on its view model). Auto is driven by useAutoMascot from the chat's data
 * parts, its status and the reply being written (his thinking ends when the
 * words start), and plays the turn's events. The page lays out the
 * conversation and the message box, with Auto in the mascot column and his
 * caption saying what he is doing; an empty chat is the first open, with no
 * page header over it (the hero's headline is its h1). Stop tells
 * Auto first (no celebration for a stopped turn), then stops the chat. A spent
 * trial shows the core's banner above the box. A card whose reply left the
 * conversation (Try again, a request failing mid-turn, the conversation shown
 * again) shows after it, in its column, until answered or closed.
 *
 * Two components, so Auto hears the chat in the PRD-260 order: the chat in
 * PlayChatView, Auto and the screen in its child, whose effects (Auto's
 * reading of the status and the reply) run before the turn's own (a failure,
 * an approval card waiting or settled) in every commit.
 *
 * Play 1.2.0: the host's voice button stands beside Send (message-box.tsx), and while a voice session runs Auto
 * follows it rather than the chat (use-auto-on-screen.ts): listening while the microphone is open, thinking, then
 * speaking with his ring following his voice. The words it heard and spoke are the conversation's: the host puts them
 * at the end of its messages (voice-live-user, voice-live-assistant) until the saved turn takes their place, so the
 * message list draws them as your message and Auto's reply. Typing stays as it was.
 *
 * Play 1.2.0, on a phone (lib/play/phone-layout.ts), the Ember design's 390 chat: no mascot column (page-columns.tsx);
 * Auto stands at his small size beside his caption over the message box instead, and the voice button has no
 * hotkey, since there is no keyboard to hold.
 *
 * Play 1.2.1: Auto's hello (once per browser session, lib/mascot/session.ts) plays only on an empty chat, the first
 * open it belongs to. A conversation opened first in a session (a link to it in a new tab, a reload, one picked from
 * Conversations) no longer gets "Hi, I'm Auto." beside it; the session's hello waits for its first empty chat.
 *
 * Play 1.3.0 (PRD-268 §6.12.4), the proactive area: an empty chat with the day's brief, or Auto's calibration on day
 * one, draws them in the first open's place (OpeningCards), with the page header and, on a desktop, Auto in the
 * mascot column, where his hello still plays (and for a calibration always does); on a phone he stands over the box
 * as in a conversation. With neither, the empty chat is the first open as before. In a conversation the brief is its
 * own message's card (message-list.tsx). The newest open suggestion is pinned between PlayTrialBanner and MessageBox,
 * stepping aside while the turn's Mission suggestion is unanswered and for a suggestion the brief on screen lists.
 * Approvals stay inline in Auto's reply, with Auto listening while one waits; Play draws no sheet over them.
 */

export interface PlayChatViewProps {
  /** The conversation on screen, as usePlayConversation hands it out; key the view by `conversation.key`. */
  readonly conversation: HostChatConversation
  /** How long without input before Auto naps (tests shorten it). */
  readonly idleMs?: number
  /** A link's words for the message box (a Deliverable's "Ask Auto about this"). */
  readonly draft?: HostChatDraft | null
  /** The words are in the box: the link's draft is spent. */
  readonly onDraftTaken?: () => void
}

type ChatWithAutoProps = Omit<PlayChatViewProps, 'conversation'> & { readonly turn: PlayTurn }

const BACKEND_OF: Readonly<Record<HostHealth['connection'], BackendStatus | undefined>> = {
  connected: 'up',
  down: 'down',
  checking: undefined,
}

/**
 * Auto, driven by the chat's status and the reply being written, and connected to the chat's parts and events; his
 * hello asked for while the chat is empty, never over a conversation.
 */
function usePlayAuto({ chat, connect }: PlayTurn, live: readonly HostChatMessage[], idleMs: number | undefined) {
  const { connection } = useHealth()
  const auto = useAutoMascot({
    status: chat.status,
    errorCode: chat.errorCode,
    reply: replyProgress(live),
    backend: BACKEND_OF[connection],
    idleMs,
  })
  // In the render that makes the driver, before any effect of this commit (use-play-turn.ts).
  connect(auto)
  const { greet } = auto
  const empty = live.length === 0
  useEffect(() => {
    if (empty) greet()
  }, [greet, empty])
  return auto
}

/**
 * The box's fill (an example chip's words, or a link's draft, each in a fresh
 * box: a new key, so it focuses with them), and focus and blur as Auto's events
 * (he listens while you type). A link's draft is taken once.
 */
function useComposer(auto: AutoMascotDriver, linked: HostChatDraft | null, onTaken?: () => void) {
  const [fill, setFill] = useState<HostChatDraft | null>(linked)
  useEffect(() => {
    if (!linked) return
    setFill((prev) => (prev === linked ? prev : { text: linked.text, serial: (prev?.serial ?? 0) + 1 }))
    onTaken?.()
  }, [linked, onTaken])
  const { dispatch } = auto
  const pick = useCallback((text: string) => setFill((prev) => ({ text, serial: (prev?.serial ?? 0) + 1 })), [])
  const onFocus = useCallback(() => dispatch({ type: 'input-focus' }), [dispatch])
  const onBlur = useCallback(() => dispatch({ type: 'input-blur' }), [dispatch])
  return { fill, pick, onFocus, onBlur }
}

/**
 * Try again (the chat's: it clears the turn's suggestion first, as chat.tsx
 * does on a new message) goes with the failed turn's snag box, so focus moves
 * to the message box, never to <body> (P260-FX-22, M20). Stop tells Auto first
 * (a done receipt no longer celebrates the stopped turn), then runs the chat's
 * stop, which keeps the reply being written and stops the turn.
 */
function useSending(chat: HostChatController, auto: AutoMascotDriver, box: RefObject<HTMLTextAreaElement | null>) {
  const { retry: askAgain, stop } = chat
  const { dispatch } = auto
  const retry = useCallback(() => {
    if (askAgain()) box.current?.focus()
  }, [askAgain, box])
  const onStop = useCallback(() => {
    dispatch({ type: 'stop' })
    stop()
  }, [dispatch, stop])
  return { retry, onStop }
}

/** The conversation's chat; Auto and the screen in the child (see above). */
export function PlayChatView({ conversation, ...screen }: PlayChatViewProps) {
  const turn = usePlayTurn(conversation)
  return <ChatWithAuto turn={turn} {...screen} />
}

/** The first open, the cards in its place, or the conversation, by what the chat holds (see above). */
interface ChatBodyProps {
  readonly chat: HostChatController
  readonly live: readonly HostChatMessage[]
  readonly retry: () => void
  readonly proactive: PlayProactive
  /** The chat draws the first open: empty, with nothing from Auto in its place. */
  readonly firstOpen: boolean
  readonly shown: AutoOnScreen
  readonly onClipEnded: AutoMascotDriver['onClipEnded']
  readonly onSomethingOff: () => void
}

function ChatBody({ chat, live, retry, proactive, firstOpen, shown, onClipEnded, onSomethingOff }: ChatBodyProps) {
  if (firstOpen) {
    return (
      <FirstOpenHero
        state={shown.state} onClipEnded={onClipEnded} speaking={shown.speaking} voiceActive={shown.voiceActive}
        {...shown.caption}
      />
    )
  }
  if (live.length === 0) {
    return <OpeningCards brief={proactive.brief} calibration={proactive.calibration} onSomethingOff={onSomethingOff} />
  }
  return <ConversationMessages chat={chat} live={live} retry={retry} brief={proactive.brief} />
}

interface ChatFooterProps {
  readonly chat: HostChatController
  readonly firstOpen: boolean
  /** Auto over the box, on a phone outside the first open; null otherwise. */
  readonly strip: ReactNode
  /** The suggestions the brief on screen lists with their Start: never pinned as well. */
  readonly listed: readonly string[]
  readonly onPick: (text: string) => void
  /** The message box. */
  readonly children: ReactNode
}

/** Under the chat: the first open's examples, Auto on a phone, the trial banner, the pinned suggestion, the box. */
function ChatFooter({ chat, firstOpen, strip, listed, onPick, children }: ChatFooterProps) {
  return (
    <div className={styles.footer}>
      {firstOpen && <ExampleChips onPick={onPick} />}
      {strip}
      <PlayTrialBanner errorCode={chat.errorCode} trialExhausted={chat.trialExhausted} />
      <PlayPinnedSuggestion hidden={missionSuggestionOpen(chat.suggestion, chat.planningMissionId)} listed={listed} />
      {children}
    </div>
  )
}

function ChatWithAuto({ turn, idleMs, draft, onDraftTaken }: ChatWithAutoProps) {
  const { chat } = turn
  // The conversation as the chat hook holds it, as the PRD-260 chat read it for Auto, his caption and the turn's end.
  const live = liveMessages(chat.messages)
  const empty = live.length === 0
  const proactive = usePlayProactive()
  const auto = usePlayAuto(turn, live, idleMs)
  useCalibrationHello(auto.dispatch, empty ? (proactive.calibration?.id ?? null) : null)
  const composer = useComposer(auto, draft ?? null, onDraftTaken)
  const box = useRef<HTMLTextAreaElement>(null)
  const focusBox = useCallback(() => box.current?.focus(), [])
  const { retry, onStop } = useSending(chat, auto, box)
  const shown = useAutoOnScreen(auto, live)
  const phone = usePhoneLayout()
  const firstOpen = empty && proactive.brief === null && proactive.calibration === null
  const listed = briefSuggestionIds(briefOnScreen(proactive.brief, live))
  const figure = (size: 'regular' | 'small') => (
    <AutoMascot state={shown.state} onClipEnded={auto.onClipEnded} speaking={shown.speaking} size={size} {...shown.caption} />
  )

  return (
    <PageColumns mascot={firstOpen ? undefined : <MascotColumn>{figure('regular')}</MascotColumn>}>
      {/* The first open has no page header: "Hi, I'm Auto." is its heading, so it fits a laptop window. */}
      {!firstOpen && <PageHeader title={chat.title} />}
      <div className={styles.chat} data-empty={firstOpen || undefined}>
        <ChatBody
          chat={chat} live={live} retry={retry} proactive={proactive} firstOpen={firstOpen} shown={shown}
          onClipEnded={auto.onClipEnded} onSomethingOff={focusBox}
        />
        <ChatFooter
          chat={chat} firstOpen={firstOpen} onPick={composer.pick} listed={listed}
          strip={phone && !firstOpen ? <div className={styles.strip}>{figure('small')}</div> : null}
        >
          <MessageBox
            ref={box}
            key={composer.fill ? `fill-${composer.fill.serial}` : 'box'}
            streaming={chat.streaming}
            onSend={chat.send}
            onStop={onStop}
            onFocus={composer.onFocus}
            onBlur={composer.onBlur}
            initialDraft={composer.fill?.text}
            autoFocus={empty || composer.fill !== null}
            voiceHotkey={phone ? null : VOICE_HOTKEY}
          />
        </ChatFooter>
      </div>
    </PageColumns>
  )
}

interface ConversationMessagesProps {
  readonly chat: HostChatController
  readonly live: readonly HostChatMessage[]
  readonly retry: () => void
  /** The day's brief: its message in the conversation draws as the card. */
  readonly brief: Brief | null
}

/** The conversation, then what follows it: a failed turn's snag box, the Mission Auto suggests, loose approval cards. */
function ConversationMessages({ chat, live, retry, brief }: ConversationMessagesProps) {
  const { streaming, trialExhausted } = chat
  return (
    <MessageList
      messages={chat.messages}
      streaming={streaming}
      onRetry={retry}
      trialBlocked={trialExhausted}
      brief={brief}
      after={
        <TurnEnd
          status={chat.status}
          trialExhausted={trialExhausted}
          messages={live}
          onRetry={retry}
          suggestion={chat.suggestion}
          planningMissionId={chat.planningMissionId}
          chatId={chat.conversation.chatId ?? ''}
          before={<LooseApprovalCards approvals={chat.looseApprovals} />}
        />
      }
    />
  )
}
