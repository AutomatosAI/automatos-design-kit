// What HUD's chat tests share (after themes/play/test/chat/play-chat-turn.test.tsx, Play 1.1.1): the stored
// conversation on screen through its ?chatId= link, the recorded turns its next sends take (the harness's scripted
// backend: a frame per tick, a held turn going on with host.continueHeldTurn), typing into the message box, and
// reading the transcript and the core back by role and name. Every value is made up.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { SPEAKER } from '../../src/chat/auto-reply.tsx'
import { PLACEHOLDER } from '../../src/chat/composer.tsx'
import { HudChatPage } from '../../src/chat/hud-chat.tsx'
import { CONVERSATION_LABEL, YOU } from '../../src/chat/transcript.tsx'
import { CORE_LABEL } from '../../src/chat/voice-core.tsx'

export type Turn = Parameters<typeof host.setChatScript>[0][number]
export type Frame = Turn['frames'][number]
type StoredChat = Parameters<typeof host.setConversations>[0][number]
export type StoredMessage = NonNullable<StoredChat['messages']>[number]

export const UPDATED = '2026-10-14T09:00:00+00:00'
export const QUESTION = 'Shortlist three laptops?'
/** What a test asks after the stored question. */
export const ASKED = 'And now?'
export const HELD: Turn = { frames: [], hold: true }
export const REFUSED: Turn = { frames: [], status: 500 }

export const words = (text: string): Frame => ({ text })
export const dataPart = (type: string, data: unknown): Frame => ({ data: { type, data } })
export const toolData = (data: unknown): Frame => dataPart('tool-data', data)
export const failure = (error: Readonly<Record<string, string>>): Frame => ({ error })
export const toolStart = (toolCallId: string, toolName: string, input?: unknown): Frame =>
  dataPart('tool-start', { toolCallId, toolName, input })
export const toolEnd = (fields: Readonly<Record<string, unknown>>): Frame => dataPart('tool-end', fields)

/** Auto's clips play on a stub: jsdom has no media playback. */
export function stubClips(): void {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
}

/** The stored conversation c1 on screen through its ?chatId= link. */
export function openChat(messages: readonly StoredMessage[] = [{ role: 'user', text: QUESTION }]): void {
  host.setConversations([{ id: 'c1', title: 'Laptop for uni', updatedAt: UPDATED, preview: null, messages }])
  host.setSearchParams('chatId=c1')
}

/** The stored conversation on screen with the turns its next sends take, once its transcript shows. */
export async function renderChat(turns: readonly Turn[] = [], messages?: readonly StoredMessage[]) {
  openChat(messages)
  host.setChatScript(turns)
  const view = render(<HudChatPage />)
  await screen.findByRole('list', { name: CONVERSATION_LABEL })
  return view
}

export const box = (): HTMLElement => screen.getByRole('textbox', { name: PLACEHOLDER })

/** Type into the message box and press Enter. */
export function ask(text: string = ASKED): void {
  fireEvent.change(box(), { target: { value: text } })
  fireEvent.keyDown(box(), { key: 'Enter' })
}

/** A turn's stream ends a tick after its last frame (the harness plays a frame per tick): let that tick pass. */
export const streamEnds = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

/** The core: its data-state is Auto's state. */
export const core = (): HTMLElement => screen.getByRole('group', { name: CORE_LABEL })

/** Auto's newest reply. */
export function reply(): HTMLElement {
  const replies = screen.getAllByRole('article', { name: `${SPEAKER} said` })
  return replies[replies.length - 1]
}

/** Your newest row. */
export function yourRow(): HTMLElement {
  const rows = screen.getAllByRole('article', { name: `${YOU} said` })
  return rows[rows.length - 1]
}
