/**
 * PRD-268 K17 (SDK 1.4.0): a made-up Auto thread on the fixtures' morning, a conversation the backend holds whose
 * stored messages carry the parts a theme that owns /chat reads (HostChatMessage.knownParts), for a theme's tests
 * (`host.setConversations(AUTO_THREAD)`, then `host.setSearchParams('chatId=' + AUTO_THREAD_CHAT_ID)` to open it):
 *
 * - Auto's brief, its prose beside its brief@1 part: the sample brief (fixtures/proactive/brief.json, the one useBrief
 *   answers on the harness page), which a theme finds by its part, never by its prose;
 * - the owner's question about it;
 * - Auto's answer, with the suggestion it posted into the thread (a suggestion@1 part naming
 *   fixtures/proactive/suggestions.json's first, which useSuggestions lists and Start and Hide take) and two reply
 *   chips (a reply_chips@1 part), each tap the owner's own message.
 *
 * Every word is made up. The transcript (fixtures/conversations/transcript.json) carries a suggestion@1 and a
 * reply_chips@1 part too, so a theme's chat shots show them.
 *
 * BRIEF_THREAD is the same thread on the fixtures' morning before anything else is said in it: Auto's brief alone, its
 * prose beside its brief@1 part, as the host posts it, so the brief is the conversation's newest exchange (the showcase's
 * demo extra `brief-thread`, src/host/demo-data.ts).
 */
import brief from '../../../fixtures/proactive/brief.json'
import suggestions from '../../../fixtures/proactive/suggestions.json'
import { conversationsOf } from './chat-script.ts'
import { BRIEF_PART, REPLY_CHIPS_PART, SUGGESTION_PART, TEXT_PART } from './message-parts.ts'

export const AUTO_THREAD_CHAT_ID = 'harness-chat-auto-thread'
const QUESTION = 'Which one first?'
const ANSWER = 'Start with the laptop prices: two of the three changed this week, and the shortlist is due on Friday.'
const CHIPS: readonly string[] = ['Start it', 'Not now']
const SUGGESTION_ID = suggestions.suggestions[0]?.id ?? ''

const THREAD_TITLE = 'Auto'
/** Auto's brief as the host posts it: its prose, beside its brief@1 part. */
const BRIEF_POST = { role: 'assistant', text: brief.prose, parts: [{ type: TEXT_PART, text: brief.prose }, { type: BRIEF_PART, brief }] }

/** The thread, every field checked as a conversation fixture's (chat-script.ts conversationsOf). */
export const AUTO_THREAD = conversationsOf([{
  id: AUTO_THREAD_CHAT_ID,
  title: THREAD_TITLE,
  updatedAt: brief.generated_at,
  preview: ANSWER,
  messages: [
    BRIEF_POST,
    { role: 'user', text: QUESTION },
    {
      role: 'assistant',
      text: ANSWER,
      parts: [
        { type: TEXT_PART, text: ANSWER },
        { type: SUGGESTION_PART, suggestion_id: SUGGESTION_ID },
        { type: REPLY_CHIPS_PART, replies: CHIPS },
      ],
    },
  ],
}], 'the Auto thread')

export const BRIEF_THREAD_CHAT_ID = 'harness-chat-brief-thread'

/** The thread holding Auto's brief alone, checked as AUTO_THREAD is. */
export const BRIEF_THREAD = conversationsOf([{
  id: BRIEF_THREAD_CHAT_ID,
  title: THREAD_TITLE,
  updatedAt: brief.generated_at,
  preview: brief.prose,
  messages: [BRIEF_POST],
}], 'the brief thread')
