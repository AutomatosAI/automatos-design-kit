/**
 * The made-up exchange the harness can open the chat on (the toolbar's Transcript, the shots' transcript group), so a
 * theme's chat page is shot with a conversation on it, not only empty: one conversation the backend holds
 * (fixtures/conversations/transcript.json: the owner's words, then Auto's reply with a tool line and the Deliverable it
 * made, its turn's frames in the recorded stream's format), linked from the address with `?chatId=`, as core's deep
 * link opens a stored conversation (frontend/lib/chat-controller/conversation.ts). The fake chat opens it with its
 * history (src/sdk/chat.ts), and the theme's conversation lists show it.
 */
import transcript from '../../fixtures/conversations/transcript.json'
import { host } from '../host.ts'

/** core's lib/chat-controller/view-model.ts CHAT_ID_PARAM. */
const CHAT_ID_PARAM = 'chatId'
const NONE = ''

export const TRANSCRIPT_CONVERSATIONS = host.conversationsOf(transcript, 'fixtures/conversations/transcript.json')
export const TRANSCRIPT_CHAT_ID = TRANSCRIPT_CONVERSATIONS[0]?.id ?? NONE

/** The chat on the transcript (the backend holds it and the address links it), or on a new chat with none held. */
export function showTranscript(shown: boolean): void {
  host.setConversations(shown ? TRANSCRIPT_CONVERSATIONS : [])
  host.setSearchParams(shown ? new URLSearchParams({ [CHAT_ID_PARAM]: TRANSCRIPT_CHAT_ID }).toString() : NONE)
}
