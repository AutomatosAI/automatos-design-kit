/**
 * The demo extras' data (src/host/demo.ts names them), which the harness page gives the fake host when its address asks
 * for them (app/host.tsx prepareHost, after src/host/sample-data.ts's answers): the roster with every agent active, five
 * older conversations held beside the transcript, Play's hello played this session, the recorded turn that raises
 * an approval as the answer to the next send, Auto's thread holding the day's brief as the conversation on screen, and
 * Auto reading one row of the brief. Made-up data.
 */
import type { RosterAgent } from '@automatos/theme-sdk'
import older from '../../fixtures/conversations/showcase.json'
import turns from '../../fixtures/streams/turns.json'
import { BRIEF_THREAD } from '../internal/scripted/auto-thread.ts'
import { host } from '../host.ts'
import type { ConversationFixture } from '../sdk/chat.ts'
import { writeThemeState } from '../sdk/storage.ts'
import { BRIEF_ROW_READ, HELLO_KEY, HELLO_STATE, type DemoExtra } from './demo.ts'
import { SAMPLE_PAGE_DATA } from './sample-data.ts'

const ACTIVE = 'active'
const NO_CONVERSATIONS: readonly ConversationFixture[] = Object.freeze([])

/** The sample roster with every agent active and able to run: `healthy-agents`. */
export const HEALTHY_ROSTER: readonly RosterAgent[] = Object.freeze(
  SAMPLE_PAGE_DATA.agents.map((agent) => Object.freeze({ ...agent, status: ACTIVE, unavailable: null })),
)

/** Five older conversations, from earlier today back to two weeks before the fixtures' morning: `older-chats`. */
export const OLDER_CONVERSATIONS = host.conversationsOf(older, 'fixtures/conversations/showcase.json')

/** The recorded turn the next send takes under `approval-turn`: an approval, with its view, waiting for the member. */
export const APPROVAL_TURN = 'approvalView'
const RECORDED_TURNS = host.recordedTurns(turns, 'fixtures/streams/turns.json')

/** The conversations the backend holds beside the transcript (or a new chat): the older ones, when asked for. */
export function olderConversations(extras: readonly DemoExtra[]): readonly ConversationFixture[] {
  return extras.includes('older-chats') ? OLDER_CONVERSATIONS : NO_CONVERSATIONS
}

/** The conversation the chat opens on in place of the transcript or a new chat: the brief thread, when asked for. */
export function openedConversation(extras: readonly DemoExtra[]): ConversationFixture | null {
  return extras.includes('brief-thread') ? BRIEF_THREAD[0] ?? null : null
}

/**
 * Gives the fake host the roster, the chat's next turn, the brief row Auto reads and the session's theme state the
 * extras ask for; nothing for none.
 */
export function giveDemo(extras: readonly DemoExtra[]): void {
  if (extras.includes('healthy-agents')) host.setPageQuery('useAgents', { data: HEALTHY_ROSTER })
  if (extras.includes('approval-turn')) host.setChatScript(host.scriptOf(RECORDED_TURNS, [APPROVAL_TURN]))
  if (extras.includes('brief-row')) host.setBriefRow(BRIEF_ROW_READ)
  if (!extras.includes('hello-played')) return
  const kept = writeThemeState(HELLO_KEY, true, HELLO_STATE)
  if (!kept.ok) throw new Error(`the harness could not mark Play's hello played: ${kept.message}`)
}
