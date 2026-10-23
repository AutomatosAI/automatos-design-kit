/**
 * PRD-261 B-02c: the pure helpers of the fake SDK area `deliverables` (src/sdk/deliverables.ts re-exports them by
 * their SDK names). Not an SDK area of its own. Each mirrors core's (101a0bf33f64fb4f89af81b4293415be60b661ac)
 * frontend/lib/deliverables/download.ts, which lib/theme-sdk/deliverables.ts:25 re-exports, lib/deliverables/tabs.ts
 * and components/icons/deliverable-icon.tsx, and answers as core's does for every input. No state.
 */
import type { DeliverableTab } from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')

/** download.ts:18 and :24: the name of a file that names none, and a workspace file's content route (JSON). */
const DEFAULT_FILENAME = 'download'
const CONTENT_ROUTE = /^\/api\/workspaces\/([^/]+)\/files\/content\?path=([^&#]*)/

/** lib/deliverables/tabs.ts:2, in the strip's order. */
const DELIVERABLE_TABS: readonly DeliverableTab[] = Object.freeze(['outputs', 'blogs', 'templates', 'brand', 'socials'])

/** components/icons/deliverable-icon.tsx:21-30: each kind's name. */
const KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  report: 'Reports',
  image: 'Images',
  document: 'Documents',
  code: 'Code',
  slide: 'Slides',
  spreadsheet: 'Spreadsheets',
  blog_post: 'Blog Posts',
  video: 'Videos',
})

/** download.ts:27: the detail's file route, else the preview, else none. */
export const deliverableFileUrl: Sdk['deliverableFileUrl'] = (deliverable) => deliverable.content_url || deliverable.preview_url || null

/** download.ts:32: the path a query carries, decoded once; null when it isn't valid percent-encoding. */
function decodedPath(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch (error) {
    console.warn("[deliverables] a file route's path isn't valid percent-encoding, so Download keeps the route:", error)
    return null
  }
}

/** download.ts:42 over lib/api-client.ts:3086: a content route becomes the file's raw route; any other is unchanged. */
export const fileDownloadUrl: Sdk['fileDownloadUrl'] = (url) => {
  const match = CONTENT_ROUTE.exec(url)
  const path = match ? decodedPath(match[2] ?? '') : null
  return match && path !== null ? `/api/workspaces/${match[1]}/files/raw?path=${encodeURIComponent(path)}` : url
}

/** download.ts:49: what Download fetches, the file's bytes, never a content route's JSON; null with no file. */
export const deliverableDownloadUrl: Sdk['deliverableDownloadUrl'] = (deliverable) => {
  const url = deliverableFileUrl(deliverable)
  return url ? fileDownloadUrl(url) : null
}

/** download.ts:55: the file's own name, else the last segment of its path. */
export const deliverableFilename: Sdk['deliverableFilename'] = (deliverable) =>
  deliverable.file_name || deliverable.file_path?.split('/').pop() || DEFAULT_FILENAME

/** deliverables.ts:153 over tabs.ts:25: Socials only while the platform offers it. */
export const visibleDeliverableTabs: Sdk['visibleDeliverableTabs'] = (socialsAvailable) =>
  DELIVERABLE_TABS.filter((tab) => tab !== 'socials' || socialsAvailable)

/** deliverables.ts:158: a kind's name ("Reports"); a kind the host has no name for is named as it is. */
export const deliverableLabel: Sdk['deliverableLabel'] = (kind) =>
  Object.prototype.hasOwnProperty.call(KIND_LABELS, kind) ? (KIND_LABELS[kind] ?? kind) : kind
