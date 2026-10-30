import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import {
  FirstRunNudge,
  type HostChatController,
  type HostChatConversation,
  type HostChatMessage,
  type HostHealth,
  TrialExhaustedBanner,
  useHealth,
  useLook,
  useTrial,
  useVoice,
  VoiceButton,
} from '@automatos/theme-sdk'

import { usePhoneLayout } from '../frame/phone-layout'
import { useMotion } from '../motion/use-motion'
import { Composer } from './composer'
import { Dialogue } from './dialogue'
import { PartyStrip, PartyWindow } from './party'
import { liveMessages, replyProgress } from './reply'
import { portraitState, sayingId, sayingOf } from './saying'
import { Story } from './story'
import { speedOf } from './typewriter'
import { type AutoDriver, type BackendStatus, useAuto } from './use-auto'
import { type Turn, useTurn } from './use-turn'
import styles from './chat.module.css'
import ui from '../ui/ui.module.css'

/**
 * One conversation on Arcade's /chat: the story window and the dialogue window, with the party beside them on a
 * desktop and over them on the handheld. The chat is the host's (the SDK's useChatController, through use-turn.ts);
 * Auto's portrait follows it (use-auto.ts) and the host's voice session. Two components, so Auto hears the chat in
 * order: the chat in ChatView, Auto and the screen in its child, whose effects run before the turn's own.
 */

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

/** The replies already in the conversation when it opened: they show whole, not typed again. */
function useWholeIds(chat: HostChatController): ReadonlySet<string> {
  const [ids] = useState(() => new Set(chat.messages.filter((message) => !message.writing).map((message) => message.id)))
  return ids
}

/** Auto driven by the chat, connected to its parts and events, and his opening hello on a new chat. */
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

interface StripProps {
  readonly chat: HostChatController
  readonly sending: Sending
  readonly boxRef: RefObject<HTMLTextAreaElement | null>
  readonly phone: boolean
  readonly onTyping: (typing: boolean) => void
}

/** The host strip: the banner for used-up credits, the message box and, on a desktop, the host's voice button. */
function Strip({ chat, sending, boxRef, phone, onTyping }: StripProps) {
  return (
    <>
      <TrialBanner chat={chat} />
      <Composer
        boxRef={boxRef}
        streaming={chat.streaming}
        onSend={sending.send}
        onStop={sending.onStop}
        autoFocus={chat.messages.length === 0 && !phone}
        onTyping={onTyping}
        voice={phone ? null : <VoiceButton />}
      />
    </>
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
  const look = useLook().look as { readonly textSpeed?: string } | null
  const voice = useVoice()
  const wholeIds = useWholeIds(chat)
  const saying = sayingOf(chat.messages, chat.streaming)
  const { dispatch } = auto
  const onTyping = useCallback((typing: boolean) => dispatch({ type: typing ? 'input-focus' : 'input-blur' }), [dispatch])
  const strip = <Strip chat={chat} sending={sending} boxRef={boxRef} phone={phone} onTyping={onTyping} />
  return (
    <div className={styles.chat} data-layout={phone ? 'phone' : 'desktop'}>
      <div className={`${ui.host} ${styles.nudge}`}>
        <FirstRunNudge />
      </div>
      {phone && <PartyStrip />}
      <div className={styles.column}>
        <Story chat={chat} live={live} sayingId={sayingId(saying)} onRetry={sending.retry} />
        <Dialogue
          portrait={portraitState(auto.mascot, voice.phase)}
          phone={phone}
          strip={strip}
          saying={saying}
          speed={speedOf(look?.textSpeed)}
          moving={moving}
          wholeIds={wholeIds}
        />
      </div>
      {!phone && <PartyWindow />}
    </div>
  )
}
