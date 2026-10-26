import { type RefObject, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useVoice } from '@automatos/theme-sdk'

import { isVoiceRunning } from '../../voice/session'
import { VoiceWords, useVoiceWords } from '../../voice/voice-words'
import { PHONE_BARS } from '../../voice/wave'
import { Waveform } from '../../voice/waveform'
import type { ChatParts } from '../chat-parts'
import { TrialBanner } from '../chat-footer'
import { OPENING } from '../chip'
import { Composer } from '../composer'
import { EmptyChat } from '../empty-chat'
import { TurnEnd } from '../turn-end'
import { VoiceCore } from '../voice-core'
import { PhoneControls } from './phone-controls'
import { PhoneScreen } from './phone-screen'
import { PhoneTranscript } from './phone-transcript'
import { StatusLine } from './status-line'
import { useFollowEnd } from './use-follow-end'

/**
 * One conversation on the phone core screen (phone-screen.tsx), from the chat the desktop's core screen draws from
 * (chat-parts.ts): Auto in the phone's core, the last exchange, and the dock. The message box is the desktop's
 * (composer.tsx: Enter sends, Esc stops, the host's AI label fence around it), shut until TYPE opens it in the dock,
 * over the waveform and the control row with the host's voice button; opening it puts the focus in it, and shutting
 * it keeps its words for next time. An empty chat's starter opens it with its words. While a voice session runs,
 * what was said aloud takes the last exchange's place (src/voice/voice-words.tsx) until the turn lands in the
 * conversation. STOP stops the reply as the box's Stop does and ends a voice session, and with the box shut hands the
 * focus to TYPE, since STOP itself is disabled once nothing runs.
 */

interface Typing {
  readonly open: boolean
  readonly toggle: () => void
  readonly onStarter: (text: string) => void
  readonly typeRef: RefObject<HTMLButtonElement | null>
}

interface Stopping {
  /** Auto is answering or a voice session runs. */
  readonly stoppable: boolean
  readonly stop: () => void
}

type TypingParts = Pick<ChatParts, 'boxRef' | 'fillBox'>

/** The message box open or shut, TYPE, and a starter opening it; `boxRef` gets the focus as it opens. */
function useTyping({ boxRef, fillBox }: TypingParts): Typing {
  const [open, setOpen] = useState(false)
  const typeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) boxRef.current?.focus()
  }, [open, boxRef])
  const toggle = useCallback(() => setOpen((was) => !was), [])
  const onStarter = useCallback((text: string) => {
    setOpen(true)
    fillBox(text)
  }, [fillBox])
  return { open, toggle, onStarter, typeRef }
}

/**
 * STOP: the voice session ended while one runs (the host's stop()), the reply stopped while Auto answers (the box's
 * Stop), and with the box shut the focus handed to TYPE.
 */
function useStop(streaming: boolean, { onStop }: ChatParts['sending'], typing: Typing): Stopping {
  const { phase, stop: stopVoice } = useVoice()
  const talking = isVoiceRunning(phase)
  const { open, typeRef } = typing
  const stop = useCallback(() => {
    if (talking) stopVoice()
    if (streaming) onStop()
    if (!open) typeRef.current?.focus()
  }, [talking, stopVoice, streaming, onStop, open, typeRef])
  return { stoppable: streaming || talking, stop }
}

export function PhoneChat({ chat, live, auto, chip, sending, boxRef, fill, fillBox }: ChatParts) {
  const typing = useTyping({ boxRef, fillBox })
  const stopping = useStop(chat.streaming, sending, typing)
  const said = useVoiceWords()
  const scrollRef = useFollowEnd(chat.messages)
  const composerId = useId()
  const transcript = (
    <PhoneTranscript
      messages={chat.messages}
      streaming={chat.streaming}
      onRetry={sending.retry}
      trialBlocked={chat.trialExhausted}
      after={<TurnEnd chat={chat} messages={live} onRetry={sending.retry} />}
      empty={<EmptyChat onStarter={typing.onStarter} />}
      aloud={said === null ? null : <VoiceWords words={said} phone />}
    />
  )
  const dock = (
    <>
      <TrialBanner errorCode={chat.errorCode} trialExhausted={chat.trialExhausted} />
      <div id={composerId} hidden={!typing.open}>
        <Composer boxRef={boxRef} streaming={chat.streaming} onSend={sending.send} onStop={sending.onStop} fill={fill} />
      </div>
      <Waveform bars={PHONE_BARS} entry="middle" size="small" />
      <PhoneControls
        typing={typing.open}
        composerId={composerId}
        onType={typing.toggle}
        stoppable={stopping.stoppable}
        onStop={stopping.stop}
        typeRef={typing.typeRef}
      />
    </>
  )
  const core = <VoiceCore state={auto.mascot} chip={chip} size="small" onClipEnded={auto.onClipEnded} />
  const line = <StatusLine state={auto.mascot} />
  return <PhoneScreen title={chat.title} line={line} core={core} transcript={transcript} dock={dock} scrollRef={scrollRef} />
}

/** A conversation on its way, on a phone: Auto loading in the phone's core, the words in the chip, nothing to type in. */
export function PhoneOpening({ title }: { readonly title: string }) {
  const core = <VoiceCore state="loading" chip={OPENING} size="small" />
  return <PhoneScreen title={title} line={<StatusLine state="loading" />} core={core} />
}
