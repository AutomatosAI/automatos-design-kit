// After themes/arcade/src/chat/chat-view.tsx (Arcade 1.0.0): the same chat, Auto and sending, laid out as Candy's W2
// and P2.
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  FirstRunNudge,
  type HostChatController,
  type HostChatConversation,
  type HostChatMessage,
  type HostHealth,
  TrialExhaustedBanner,
  useHealth,
  useTrial,
  useVoice,
  VoiceButton,
} from '@automatos/theme-sdk'

import { useMotion } from '../motion/use-motion'
import { Composer } from './composer'
import { Conversations } from './conversations'
import { NewChatPill } from './new-chat'
import { usePhoneLayout } from './phone-layout'
import { liveMessages, replyProgress } from './reply'
import { StageCard, StageStrip } from './stage'
import { stageOf, type Stage } from './stage-state'
import { Thread } from './thread'
import { type AutoDriver, type BackendStatus, useAuto } from './use-auto'
import { type Turn, useTurn } from './use-turn'
import styles from './chat.module.css'
import composerStyles from './composer.module.css'
import ui from '../ui/ui.module.css'

/**
 * One conversation on Candy's /chat. On a desktop (W2): the title and "+ New chat" in the header row, the thread in
 * a big white window with the message box at its foot, and the rail beside it, Auto's stage over your
 * Conversations. Below 1024 px (P2): the stage as a strip across the top with the title, then the thread, then the
 * message box with the host's voice button on its right. The chat is the host's (the SDK's useChatController,
 * through use-turn.ts); Auto's state follows it (use-auto.ts) and the host's voice session (stage-state.ts). Two
 * components, so Auto hears the chat in order: the chat in ChatView, Auto and the screen in its child, whose effects
 * run before the turn's own.
 */

export const RAIL_LABEL = 'Auto and your conversations'
const EXHAUSTED = 'exhausted'

const BACKEND_OF: Readonly<Record<HostHealth['connection'], BackendStatus | undefined>> = {
  connected: 'up',
  down: 'down',
  checking: undefined,
}

interface Sending {
  readonly send: (text: string) => boolean
  readonly retry: () => void
  readonly onStop: () => void
}

/** Send, Try again and Stop, each leaving the focus in the message box (after HUD's chat view). */
function useSending(chat: HostChatController, auto: AutoDriver, box: RefObject<HTMLTextAreaElement | null>): Sending {
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

/** The host's banner for used-up credits, while they are. */
function TrialBanner({ chat }: { readonly chat: HostChatController }) {
  const exhausted = useTrial()?.state === EXHAUSTED || chat.trialExhausted
  return exhausted ? <TrialExhaustedBanner errorCode={chat.errorCode} /> : null
}

export function ChatView({ conversation }: { readonly conversation: HostChatConversation }) {
  const turn = useTurn(conversation)
  return <ChatWithAuto turn={turn} />
}

/** Auto driven by the chat, connected to its parts and events, and his hello on a new chat. */
function useChatAuto(turn: Turn, live: readonly HostChatMessage[]): AutoDriver {
  const { chat } = turn
  const { connection } = useHealth()
  const auto = useAuto({ status: chat.status, errorCode: chat.errorCode, reply: replyProgress(live), backend: BACKEND_OF[connection] })
  // In the render that makes the driver, before any effect of this commit (use-turn.ts).
  turn.connect(auto)
  const empty = chat.messages.length === 0
  const { dispatch } = auto
  useEffect(() => {
    if (empty) dispatch({ type: 'app-open' })
  }, [empty, dispatch])
  return auto
}

interface FootProps {
  readonly chat: HostChatController
  readonly sending: Sending
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  readonly phone: boolean
  readonly onTyping: (typing: boolean) => void
}

/** The thread's foot: the banner for used-up credits, the message box and the host's voice button on its right. */
function Foot({ chat, sending, boxRef, phone, onTyping }: FootProps) {
  const voice = (
    <div className={`${ui.host} ${composerStyles.voice}`}>
      <VoiceButton size="lg" />
    </div>
  )
  return (
    <div className={styles.foot}>
      <TrialBanner chat={chat} />
      <Composer
        boxRef={boxRef}
        streaming={chat.streaming}
        onSend={sending.send}
        onStop={sending.onStop}
        autoFocus={chat.messages.length === 0 && !phone}
        onTyping={onTyping}
        voice={voice}
        phone={phone}
      />
    </div>
  )
}

function Nudge() {
  return (
    <div className={`${ui.host} ${styles.nudge}`}>
      <FirstRunNudge />
    </div>
  )
}

interface TopProps {
  readonly chat: HostChatController
  readonly stage: Stage
}

/** The desktop's header row: the conversation's title and New chat, clear of the host's utilities on its right. */
function DesktopHead({ chat }: Pick<TopProps, 'chat'>) {
  return (
    <header className={`${ui.pageHead} ${styles.head}`}>
      <h1 className={`${ui.pageTitle} ${styles.title}`}>{chat.title}</h1>
      <NewChatPill />
    </header>
  )
}

/** The phone's top: the stage strip, and your conversations under it while you ask for them. */
function PhoneTop({ chat, stage }: TopProps) {
  const [listOpen, setListOpen] = useState(false)
  const listId = useId()
  const onList = useCallback(() => setListOpen((open) => !open), [])
  return (
    <div className={styles.phoneTop}>
      <StageStrip stage={stage} title={chat.title} listOpen={listOpen} listId={listId} onList={onList} />
      {listOpen && (
        <div className={styles.phoneList}>
          <Conversations id={listId} currentId={chat.conversation.chatId} />
        </div>
      )}
    </div>
  )
}

/** The desktop's rail: Auto's stage over your Conversations. */
function Rail({ chat, stage }: TopProps) {
  return (
    <aside className={styles.rail} aria-label={RAIL_LABEL}>
      <StageCard stage={stage} />
      <Conversations currentId={chat.conversation.chatId} />
    </aside>
  )
}

function ChatWithAuto({ turn }: { readonly turn: Turn }) {
  const { chat } = turn
  const live = liveMessages(chat.messages)
  const auto = useChatAuto(turn, live)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const sending = useSending(chat, auto, boxRef)
  const phone = usePhoneLayout()
  const { moving } = useMotion()
  const stage = stageOf(auto.mascot, useVoice().phase)
  const { dispatch } = auto
  const onTyping = useCallback((typing: boolean) => dispatch({ type: typing ? 'input-focus' : 'input-blur' }), [dispatch])
  // One tree for both layouts, so the thread and the words in the box stay as the window crosses 1024 px.
  return (
    <div className={styles.chat} data-layout={phone ? 'phone' : 'desktop'}>
      <Nudge />
      {phone ? <PhoneTop chat={chat} stage={stage} /> : <DesktopHead chat={chat} />}
      <div className={styles.body}>
        <div className={styles.main}>
          <Thread chat={chat} live={live} face={stage.state} moving={moving} phone={phone} onRetry={sending.retry} />
          <Foot chat={chat} sending={sending} boxRef={boxRef} phone={phone} onTyping={onTyping} />
        </div>
        {!phone && <Rail chat={chat} stage={stage} />}
      </div>
    </div>
  )
}
