// Core's pure SDK helpers that Play's modules read, ported for the SDK stand-in (test/sdk-stub.ts re-exports
// them): a Deliverable's file routes and file name (lib/deliverables/download.ts, which
// lib/theme-sdk/deliverables.ts:25 re-exports) and the turn's live receipts (lib/theme-sdk/chat.ts:448 over
// lib/chat/receipts.ts), in core's frontend/ at 0dd8b846e41772c8dd7ef159e4373bcb9419b06a. Each answers as
// core's does for every input. They hold no state, so the stand-in's resetStub has nothing of theirs to put back.
import type { HostReceipt } from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')

// ---- deliverables: lib/deliverables/download.ts ----

/** :18 and :24: the name of a file that names none, and a workspace file's content route (JSON). */
const DEFAULT_FILENAME = 'download'
const CONTENT_ROUTE = /^\/api\/workspaces\/([^/]+)\/files\/content\?path=([^&#]*)/

/** :27: the detail's file route, else the preview, else none. */
export const deliverableFileUrl: Sdk['deliverableFileUrl'] = ((deliverable) =>
  deliverable.content_url || deliverable.preview_url || null)

/** :32: the path a query carries, decoded once; null when it isn't valid percent-encoding. */
function decodedPath(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch (error) {
    console.warn("[deliverables] a file route's path isn't valid percent-encoding, so Download keeps the route:", error)
    return null
  }
}

/** :42 over lib/api-client.ts:3020: a content route becomes the file's raw route; any other is unchanged. */
export const fileDownloadUrl: Sdk['fileDownloadUrl'] = ((url) => {
  const match = CONTENT_ROUTE.exec(url)
  const path = match ? decodedPath(match[2]) : null
  return match && path !== null ? `/api/workspaces/${match[1]}/files/raw?path=${encodeURIComponent(path)}` : url
})

/** :49: what Download fetches, the file's bytes, never a content route's JSON; null with no file. */
export const deliverableDownloadUrl: Sdk['deliverableDownloadUrl'] = ((deliverable) => {
  const url = deliverableFileUrl(deliverable)
  return url ? fileDownloadUrl(url) : null
})

/** :55: the file's own name, else the last segment of its path. */
export const deliverableFilename: Sdk['deliverableFilename'] = ((deliverable) =>
  deliverable.file_name || deliverable.file_path?.split('/').pop() || DEFAULT_FILENAME)

// ---- chat: lib/theme-sdk/chat.ts over lib/chat/receipts.ts ----

/** receipts.ts:84 and :23: the tool-data key of a receipts frame, and a receipt's statuses. */
const LIVE_KEY = 'receipts'
const RECEIPT_STATUSES: ReadonlySet<string> = new Set(['done', 'refused', 'skipped', 'waiting'])
/** chat.ts:309. */
const NO_LINES: readonly string[] = Object.freeze([])

type Fields = Readonly<Record<string, unknown>>

const NO_FIELDS: Fields = Object.freeze({})

/** An object's fields; none for anything else. */
const fieldsOf = (value: unknown): Fields => (typeof value === 'object' && value !== null ? (value as Fields) : NO_FIELDS)

/** receipts.ts:29: a receipt names its action and one of the statuses. */
function isReceipt(value: unknown): value is HostReceipt {
  const { action, status } = fieldsOf(value)
  return typeof action === 'string' && typeof status === 'string' && RECEIPT_STATUSES.has(status)
}

/**
 * chat.ts:448 over receipts.ts:35-91: the receipts frame on a tool-data part, its real receipts only, the
 * non-blank lines above the reply and the model it names; null for any other part and for a frame without a list.
 */
export const liveReceiptsOf: Sdk['liveReceiptsOf'] = ((part) => {
  const forwarded = fieldsOf(part)
  const frame = forwarded.type === 'tool-data' ? fieldsOf(fieldsOf(forwarded.data)[LIVE_KEY]) : NO_FIELDS
  const { receipts: list, above, model } = frame
  if (!Array.isArray(list)) return null
  const lines = Array.isArray(above) ? above.filter((line): line is string => typeof line === 'string' && line.trim() !== '') : []
  return Object.freeze({
    receipts: Object.freeze(list.filter(isReceipt)),
    above: lines.length > 0 ? Object.freeze(lines) : NO_LINES,
    model: typeof model === 'string' ? model : null,
  })
})
