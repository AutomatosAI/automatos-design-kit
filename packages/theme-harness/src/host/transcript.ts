/**
 * The made-up exchange the harness can open the chat on (the toolbar's Transcript, the shots' transcript group), so a
 * theme's chat page is shot with a conversation on it, not only empty: one conversation the backend holds
 * (fixtures/conversations/transcript.json: the owner's words, then Auto's reply with a tool line and the Deliverable it
 * made, its turn's frames in the recorded stream's format), linked from the address with `?chatId=`, as core's deep
 * link opens a stored conversation (frontend/lib/chat-controller/conversation.ts). The fake chat opens it with its
 * history (src/sdk/chat.ts), and the theme's conversation lists show it, beside any older conversations the page holds
 * (the demo extra `older-chats`, src/host/demo-data.ts).
 */
import transcript from '../../fixtures/conversations/transcript.json'
import { host } from '../host.ts'
import type { ConversationFixture } from '../sdk/chat.ts'

/** core's lib/chat-controller/view-model.ts CHAT_ID_PARAM. */
const CHAT_ID_PARAM = 'chatId'
const NONE = ''

export const TRANSCRIPT_CONVERSATIONS = host.conversationsOf(transcript, 'fixtures/conversations/transcript.json')
export const TRANSCRIPT_CHAT_ID = TRANSCRIPT_CONVERSATIONS[0]?.id ?? NONE

/** The conversation on screen: the transcript's while it shows, else a new chat's, which has no id yet (null). */
export function transcriptChatId(shown: boolean): string | null {
  return shown ? TRANSCRIPT_CHAT_ID : null
}

/**
 * The chat on the transcript (the backend holds it and the address links it), or on a new chat; the backend holds
 * `older` conversations beside it either way (none by default).
 */
export function showTranscript(shown: boolean, older: readonly ConversationFixture[] = []): void {
  host.setConversations([...(shown ? TRANSCRIPT_CONVERSATIONS : []), ...older])
  host.setSearchParams(shown ? new URLSearchParams({ [CHAT_ID_PARAM]: TRANSCRIPT_CHAT_ID }).toString() : NONE)
}
