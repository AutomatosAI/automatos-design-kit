/**
 * PRD-261 B-02b: the SDK areas the harness does not fake yet, chat, deliverables and cards (PRD-261 B-02c fakes
 * them in the same wave). Each name is here so the fake SDK's surface is whole (test/surface.test.ts): a call,
 * a render or a read of one throws "not faked yet", as core's internal/stub.ts throws for a name not in its
 * build. The areas' controls (setChatScript, setDeliverables, …) throw the same way; their resets do nothing.
 *
 * The contract B-02c's modules meet, so the lane merge swaps one area at a time: `src/sdk/<area>.ts` exports
 * the area's SDK names below, `<area>Controls` with the same control names and `reset<Area>()`; the merge
 * changes that area's line in index.ts and in host.ts from './stubs.ts' (or './sdk/stubs.ts') to its module.
 * When all three are swapped, this file exports nothing any module reads, and goes.
 */
import type {
  AuthenticatedBlobUrl, DeliverableFilters, DeliverableQuery, DeliverablesOptions, DeliverablesQuery, DeliverableTab,
} from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')
type NotFaked = (...args: readonly unknown[]) => never

const NOT_FAKED = 'is not faked yet: the chat, Deliverables and host cards fakes come with PRD-261 B-02c'

function notFakedError(name: string): Error {
  return new Error(`@automatos/theme-harness: ${name} ${NOT_FAKED}.`)
}

/** A function or component that throws when called or rendered. */
function notFaked(name: string): NotFaked {
  return () => {
    throw notFakedError(name)
  }
}

/** A constant that throws when read: any of its properties, its keys, or a spread of it. */
function notFakedValue<T extends object>(name: string): T {
  const refuse = (): never => {
    throw notFakedError(name)
  }
  return new Proxy(Object.freeze({}) as T, {
    get: (_target, property) => (typeof property === 'symbol' ? undefined : refuse()),
    has: refuse,
    ownKeys: refuse,
    getOwnPropertyDescriptor: refuse,
  })
}

// ---- chat (core frontend/lib/theme-sdk/chat.ts) ----

export const useChatController = notFaked('useChatController') satisfies Sdk['useChatController']
export const useConversationList = notFaked('useConversationList') satisfies Sdk['useConversationList']
export const useRecentChats = notFaked('useRecentChats') satisfies Sdk['useRecentChats']
export const useStartChat = notFaked('useStartChat') satisfies Sdk['useStartChat']
export const receiptLine = notFaked('receiptLine') satisfies Sdk['receiptLine']
export const receiptLink = notFaked('receiptLink') satisfies Sdk['receiptLink']
export const movedSomethingOnTheBoard = notFaked('movedSomethingOnTheBoard') satisfies Sdk['movedSomethingOnTheBoard']
export const liveReceiptsOf = notFaked('liveReceiptsOf') satisfies Sdk['liveReceiptsOf']

// ---- deliverables (core frontend/lib/theme-sdk/deliverables.ts) ----

export const DELIVERABLE_FEED_FILTERS = notFakedValue<DeliverableFilters>('DELIVERABLE_FEED_FILTERS') satisfies Sdk['DELIVERABLE_FEED_FILTERS']
export const DELIVERABLE_TAB_LABELS = notFakedValue<Readonly<Record<DeliverableTab, string>>>('DELIVERABLE_TAB_LABELS') satisfies Sdk['DELIVERABLE_TAB_LABELS']
export const useDeliverables = notFaked('useDeliverables') satisfies Sdk['useDeliverables']
export const useDeliverable = notFaked('useDeliverable') satisfies Sdk['useDeliverable']
export const useFileDownload = notFaked('useFileDownload') satisfies Sdk['useFileDownload']
export const useAuthenticatedBlobUrl = notFaked('useAuthenticatedBlobUrl') satisfies Sdk['useAuthenticatedBlobUrl']
export const deliverableFileUrl = notFaked('deliverableFileUrl') satisfies Sdk['deliverableFileUrl']
export const deliverableDownloadUrl = notFaked('deliverableDownloadUrl') satisfies Sdk['deliverableDownloadUrl']
export const fileDownloadUrl = notFaked('fileDownloadUrl') satisfies Sdk['fileDownloadUrl']
export const deliverableFilename = notFaked('deliverableFilename') satisfies Sdk['deliverableFilename']
export const visibleDeliverableTabs = notFaked('visibleDeliverableTabs') satisfies Sdk['visibleDeliverableTabs']
export const deliverableLabel = notFaked('deliverableLabel') satisfies Sdk['deliverableLabel']

// ---- cards (core frontend/lib/theme-sdk/cards.ts) ----

export const ToolApproval = notFaked('ToolApproval') satisfies Sdk['ToolApproval']
export const MissionApproval = notFaked('MissionApproval') satisfies Sdk['MissionApproval']
export const TaskCard = notFaked('TaskCard') satisfies Sdk['TaskCard']
export const WithdrawOfferCard = notFaked('WithdrawOfferCard') satisfies Sdk['WithdrawOfferCard']
export const MissionSuggestionCard = notFaked('MissionSuggestionCard') satisfies Sdk['MissionSuggestionCard']
export const MissionCreatedCard = notFaked('MissionCreatedCard') satisfies Sdk['MissionCreatedCard']
export const FilePreview = notFaked('FilePreview') satisfies Sdk['FilePreview']
export const MarkdownView = notFaked('MarkdownView') satisfies Sdk['MarkdownView']
export const MadeBy = notFaked('MadeBy') satisfies Sdk['MadeBy']
export const TrialExhaustedBanner = notFaked('TrialExhaustedBanner') satisfies Sdk['TrialExhaustedBanner']
export const FirstRunNudge = notFaked('FirstRunNudge') satisfies Sdk['FirstRunNudge']
export const HeaderUtilities = notFaked('HeaderUtilities') satisfies Sdk['HeaderUtilities']
export const AiLabelFence = notFaked('AiLabelFence') satisfies Sdk['AiLabelFence']
export const CorePage = notFaked('CorePage') satisfies Sdk['CorePage']

// ---- the areas' controls: the names Play's tests call through host.* (themes/play/test) ----

/** One call of useDeliverables: what the theme asked the list for. */
export interface DeliverablesAsk {
  readonly filters: DeliverableFilters | undefined
  readonly options: DeliverablesOptions | undefined
}

/** One call of useDeliverable: the id the theme asked for, and whether with its content. */
export interface DetailAsk {
  readonly id: string | null
  readonly includeContent: boolean
}

/** One Download: the API path fetched with the caller's token, and the name it saves under. */
export interface DownloadAsk {
  readonly url: string
  readonly filename: string
}

/** How useAuthenticatedBlobUrl answers a file's URL. */
export type BlobUrls = (url: string | undefined, forcedType?: string) => AuthenticatedBlobUrl

export const chatControls: {
  /** The turns the fake chat controller streams from now on. */
  readonly setChatScript: (script: unknown) => void
  /** The caller's conversations from now on. */
  readonly setConversations: (conversations: unknown) => void
  /** How many times a theme started a chat since the last reset. */
  readonly startedChats: () => number
} = Object.freeze({
  setChatScript: notFaked('setChatScript'),
  setConversations: notFaked('setConversations'),
  startedChats: notFaked('startedChats'),
})

export const deliverablesControls: {
  /** What useDeliverables answers from now on: react-query's result, with the test's own fetchNextPage and refetch. */
  readonly setDeliverables: (answer: DeliverablesQuery) => void
  /** Every useDeliverables call since the last reset, oldest first. */
  readonly deliverablesAsked: () => readonly DeliverablesAsk[]
  /** What useDeliverable answers from now on. */
  readonly setDetail: (answer: DeliverableQuery) => void
  /** Every useDeliverable call since the last reset, oldest first. */
  readonly detailsAsked: () => readonly DetailAsk[]
  /** How useAuthenticatedBlobUrl answers from now on (by default: no picture yet). */
  readonly setBlobUrls: (answer: BlobUrls) => void
  /** Every download a theme asked for since the last reset, oldest first. */
  readonly downloadsAsked: () => readonly DownloadAsk[]
} = Object.freeze({
  setDeliverables: notFaked('setDeliverables'),
  deliverablesAsked: notFaked('deliverablesAsked'),
  setDetail: notFaked('setDetail'),
  detailsAsked: notFaked('detailsAsked'),
  setBlobUrls: notFaked('setBlobUrls'),
  downloadsAsked: notFaked('downloadsAsked'),
})

export const cardsControls: Readonly<Record<never, never>> = Object.freeze({})

export function resetChat(): void {
  // Nothing is faked, so there is nothing to put back.
}

export function resetDeliverables(): void {
  // Nothing is faked, so there is nothing to put back.
}

export function resetCards(): void {
  // Nothing is faked, so there is nothing to put back.
}
