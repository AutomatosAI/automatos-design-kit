// After themes/arcade/src/deliverables/content.ts (Arcade 1.0.0, itself from Play 1.2.1's detail.ts): how one
// Deliverable's content shows, with the same reading of its kind and its file type; what isn't Markdown goes to the
// host's FilePreview, as core's own Deliverable sheet hands it over (gallery-view/deliverable-preview.tsx).
import { deliverableFileUrl } from '@automatos/theme-sdk'
import type { Deliverable, FilePreviewType } from '@automatos/theme-sdk'

import { kindOf } from './shelf'

/**
 * How one Deliverable's content shows in its sheet: Markdown (a report, a blog post, a text or Markdown file) through
 * the host's MarkdownView; any other text (code, CSV, JSON, a page's source) and every picture, video, PDF or
 * spreadsheet through the host's FilePreview, which loads the file with the caller's token; and a line where there is
 * nothing to show. The host's own reading of the file decides: a file the host serves as bytes is never shown as
 * text. Pure.
 */

/** File types read as Markdown; any other text goes to FilePreview. */
const MARKDOWN_TYPES: ReadonlySet<string> = new Set(['', 'md', 'markdown', 'mdx', 'txt', 'text'])
/**
 * Files the core serves as bytes (_BINARY_EXTENSIONS in services/deliverable_service.py).
 * Their inline content is the bytes read as text, so it is never shown as text.
 */
const BINARY_TYPES: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tif', 'tiff',
  'pdf', 'docx', 'xlsx', 'pptx', 'zip', 'tar', 'gz',
  'mp4', 'mp3', 'wav', 'ogg', 'webm', 'mov', 'mkv',
])
/** The core reads a report as Markdown whatever its file says. */
const MARKDOWN_KINDS: ReadonlySet<string> = new Set(['report', 'blog_post'])
/** The kinds whose preview is named, not read from the file's name. */
const MEDIA_PREVIEWS: ReadonlyMap<string, FilePreviewType> = new Map([
  ['image', 'image'],
  ['video', 'video'],
])

export type ContentView =
  | { readonly kind: 'markdown'; readonly markdown: string; readonly truncated: boolean }
  /** Text or a file's API path for the host's FilePreview; a null type is read from the file's name. */
  | { readonly kind: 'preview'; readonly content: string | null; readonly url: string | null; readonly previewType: FilePreviewType | null; readonly truncated: boolean }
  | { readonly kind: 'empty' }
  /** The host couldn't read it. */
  | { readonly kind: 'unreadable' }
  /** No text and no file to show. */
  | { readonly kind: 'none' }

/** "report.md" → "md"; "" when the name has no extension. */
function extensionOf(name: string | null | undefined): string {
  const last = (name ?? '').split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  return dot > 0 ? last.slice(dot + 1) : ''
}

/** The file's type as an extension, lowercase, without a dot: its file_type, else its name's. */
export function fileTypeOf(item: Pick<Deliverable, 'file_type' | 'file_name' | 'file_path'>): string {
  const type = item.file_type || extensionOf(item.file_name || item.file_path)
  return type.trim().toLowerCase().replace(/^\./, '')
}

function textView(content: string, kind: string, fileType: string, truncated: boolean): ContentView {
  if (!content.trim()) return { kind: 'empty' }
  if (MARKDOWN_KINDS.has(kind) || MARKDOWN_TYPES.has(fileType)) return { kind: 'markdown', markdown: content, truncated }
  return { kind: 'preview', content, url: null, previewType: null, truncated }
}

/** How the Deliverable's content shows in its sheet (`item` read with its content). */
export function contentView(item: Deliverable): ContentView {
  const kind = kindOf(item)
  const fileType = fileTypeOf(item)
  const binary = BINARY_TYPES.has(fileType)
  const text = typeof item.content === 'string' && !binary ? item.content : null
  if (text !== null) return textView(text, kind, fileType, item.content_truncated === true)
  if (Boolean(item.content_error) && !binary) return { kind: 'unreadable' }
  const url = deliverableFileUrl(item)
  if (url === null) return { kind: 'none' }
  return { kind: 'preview', content: null, url, previewType: MEDIA_PREVIEWS.get(kind) ?? null, truncated: false }
}
