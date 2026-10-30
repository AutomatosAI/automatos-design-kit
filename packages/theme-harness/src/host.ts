/**
 * PRD-261 B-02b (plan §2.2.9): the fake host's controls, the one object a theme's test drives the harness's
 * SDK with (`import { host } from '@automatos/theme-harness/host'`). Each area's fake (src/sdk/<area>.ts)
 * holds its own state and controls; this gathers them, and `host.reset()` puts every area back as a test
 * starts: the local edition's one operator in WORKSPACE_DEFAULTS, online, the backend up, a desktop width,
 * the light tone, no look runtime, no package files, STORAGE_DEFAULTS with no theme state kept, no voice session (the
 * host's voice on the page, VOICE_DEFAULTS), no calibration offered and the brief not being read (SDK 1.3.0's
 * proactive area: its reads loading until a test answers them, src/sdk/proactive.ts), nothing asked and nothing
 * refused. Call it in a beforeEach; a control set inside act() renders what reads it again.
 */
import { forgetNetworkCalls, networkCalls } from './internal/network.ts'
import { pageControls, resetPages } from './internal/page-views.ts'
import { assetControls, resetAssets } from './sdk/assets.ts'
import { contextControls, resetContext } from './sdk/context.ts'
import { eventControls, resetEvents } from './sdk/events.ts'
import { lookControls, resetLooks } from './sdk/looks.ts'
import { navigationControls, resetNavigation } from './sdk/navigation.ts'
import { noticeControls, resetNotices } from './sdk/notices.ts'
import { commandCenterControls, resetCommandCenter } from './sdk/pages-command-center.ts'
import { documentsControls, resetDocuments } from './sdk/pages-documents.ts'
import { resetStorage, storageControls } from './sdk/storage.ts'
import { chatControls, resetChat } from './sdk/chat.ts'
import { deliverablesControls, resetDeliverables } from './sdk/deliverables.ts'
import { cardsControls, resetCards } from './sdk/cards.ts'
import { resetVoice, voiceControls } from './sdk/voice.ts'
import { proactiveControls, resetProactive } from './sdk/proactive.ts'
import { briefVoiceControls, resetBriefVoice } from './sdk/brief-voice.tsx'

export { WORKSPACE_DEFAULTS, ROLE_DEFAULTS, DEFAULT_WIDTH, DEFAULT_MIN_WIDTH } from './sdk/context.ts'
export { STORAGE_DEFAULTS, THEME_STATE_KEY_PREFIX, type StorageStandIn } from './sdk/storage.ts'
export type { HealthDetails } from './sdk/context.ts'
export type { LooksStandIn } from './sdk/looks.ts'
export type { Navigation } from './sdk/navigation.ts'
export type { ShownNotice } from './sdk/notices.ts'
export type { NetworkCall } from './internal/network.ts'
export type { PageAsk, PageQueryAnswer, PageRun } from './internal/page-views.ts'
export type { DatabaseKnowledgeAnswer } from './sdk/pages-documents.ts'
export type { BlobUrls, DeliverablesAsk, DetailAsk, DownloadAsk } from './sdk/deliverables.ts'
export type { ConversationsAsk } from './sdk/chat.ts'
export { VOICE_DEFAULTS, type VoicePressRecord, type VoiceSessionStandIn } from './internal/voice-session.ts'
/**
 * The names a theme's own fixtures build the chat's parts with: the tool-data key the receipts frame rides under
 * (what the fake's liveReceiptsOf reads, core's lib/chat/receipts.ts), and the code a request refused for used-up
 * credits reports (useChatController's errorCode, core's lib/credits.ts).
 */
export { LIVE_KEY } from './internal/scripted/chat-reply.ts'
export { CREDITS_EXHAUSTED_CODE } from './internal/scripted/chat-turn.ts'

/**
 * Every area's reset. Storage first: it forgets the last test's subscribers before the context's workspace,
 * which the storage scope follows, goes back to WORKSPACE_DEFAULTS (STORAGE_DEFAULTS' workspace already).
 */
const RESETS: readonly (() => void)[] = Object.freeze([
  resetStorage, resetContext, resetNavigation, resetNotices, resetEvents, resetLooks, resetAssets,
  resetPages, resetCommandCenter, resetDocuments, resetChat, resetDeliverables, resetCards, resetVoice, resetProactive, resetBriefVoice,
  forgetNetworkCalls,
])

export const host = Object.freeze({
  /** Every control's default, nothing asked, no theme state in the window's storage. */
  reset(): void {
    RESETS.forEach((resetArea) => resetArea())
  },
  ...contextControls,
  ...navigationControls,
  ...noticeControls,
  ...eventControls,
  ...lookControls,
  ...assetControls,
  ...storageControls,
  ...pageControls,
  ...commandCenterControls,
  ...documentsControls,
  ...chatControls,
  ...deliverablesControls,
  ...cardsControls,
  ...voiceControls,
  ...proactiveControls,
  ...briefVoiceControls,
  /** Every fetch and XMLHttpRequest the harness refused since the last reset, oldest first. */
  networkCalls,
})

export type Host = typeof host
