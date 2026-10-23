/**
 * PRD-261 B-02b (plan §2.2.9): the fake host's controls, the one object a theme's test drives the harness's
 * SDK with (`import { host } from '@automatos/theme-harness/host'`). Each area's fake (src/sdk/<area>.ts)
 * holds its own state and controls; this gathers them, and `host.reset()` puts every area back as a test
 * starts: the local edition's one operator in WORKSPACE_DEFAULTS, online, the backend up, a desktop width,
 * the light tone, no look runtime, no package files, STORAGE_DEFAULTS with no theme state kept, nothing asked
 * and nothing refused. Call it in a beforeEach; a control set inside act() renders what reads it again.
 *
 * Chat, deliverables and cards are stubs.ts's until PRD-261 B-02c fakes them; the lane merge changes each of
 * those three import lines to the area's own module ('./sdk/chat.ts', './sdk/deliverables.ts', './sdk/cards.ts').
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
import { chatControls, resetChat } from './sdk/stubs.ts'
import { deliverablesControls, resetDeliverables } from './sdk/stubs.ts'
import { cardsControls, resetCards } from './sdk/stubs.ts'

export { WORKSPACE_DEFAULTS, ROLE_DEFAULTS, DEFAULT_WIDTH, DEFAULT_MIN_WIDTH } from './sdk/context.ts'
export { STORAGE_DEFAULTS, THEME_STATE_KEY_PREFIX, type StorageStandIn } from './sdk/storage.ts'
export type { HealthDetails } from './sdk/context.ts'
export type { LooksStandIn } from './sdk/looks.ts'
export type { Navigation } from './sdk/navigation.ts'
export type { ShownNotice } from './sdk/notices.ts'
export type { NetworkCall } from './internal/network.ts'
export type { PageAsk, PageQueryAnswer, PageRun } from './internal/page-views.ts'
export type { DatabaseKnowledgeAnswer } from './sdk/pages-documents.ts'
export type { BlobUrls, DeliverablesAsk, DetailAsk, DownloadAsk } from './sdk/stubs.ts'

/**
 * Every area's reset. Storage first: it forgets the last test's subscribers before the context's workspace,
 * which the storage scope follows, goes back to WORKSPACE_DEFAULTS (STORAGE_DEFAULTS' workspace already).
 */
const RESETS: readonly (() => void)[] = Object.freeze([
  resetStorage, resetContext, resetNavigation, resetNotices, resetEvents, resetLooks, resetAssets,
  resetPages, resetCommandCenter, resetDocuments, resetChat, resetDeliverables, resetCards, forgetNetworkCalls,
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
  /** Every fetch and XMLHttpRequest the harness refused since the last reset, oldest first. */
  networkCalls,
})

export type Host = typeof host
