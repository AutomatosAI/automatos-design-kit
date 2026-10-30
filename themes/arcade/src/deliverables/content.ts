// Copied from themes/play/src/lib/play/detail.ts (Play 1.2.1): how one Deliverable's content shows, as it is but for
// these lines, the kind read through Arcade's own helper, and the parts Arcade doesn't show left out.
import { type Deliverable, deliverableFileUrl } from '@automatos/theme-sdk'

/**
 * How one Deliverable's content shows in its item window: text and Markdown through the host's MarkdownView (a text
 * file that isn't Markdown as a code block), a picture or a video fetched with the caller's token, and anything else
 * as a file with Download. The host's own reading of the file decides: a report is Markdown whatever its file says,
 * and a file the host serves as bytes is never shown as text. Pure.
 */

function kindOf(deliverable: Pick<Deliverable, 'artifact_type'>): string {
  const kind = deliverable.artifact_type?.trim().toLowerCase()
  return kind ? kind : 'document'
}

/** File types read as markdown; any other text file shows verbatim in a code block. */
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
/** The core reads a report as markdown whatever its file says (DeliverablePreview). */
const MARKDOWN_KINDS: ReadonlySet<string> = new Set(['report', 'blog_post'])
const CODE_LANGUAGE = /^[a-z0-9]{1,16}$/
const MIN_FENCE = 3

export type ContentView =
  /** Markdown (or a text file wrapped as a code block) for the core's markdown renderer. */
  | { readonly kind: 'text'; readonly markdown: string; readonly truncated: boolean }
  | { readonly kind: 'empty' }
  /** A picture or a video, fetched from `url` through the core's authenticated file path. */
  | { readonly kind: 'image' | 'video'; readonly url: string }
  /** Nothing to show here: the file card, with Download when `url` names the file. */
  | { readonly kind: 'file'; readonly reason: 'unsupported' | 'unreadable'; readonly url: string | null }

/** "report.md" → "md"; "" when the name has no extension. */
function extensionOf(name: string | null | undefined): string {
  const last = (name ?? '').split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  return dot > 0 ? last.slice(dot + 1) : ''
}

/** The file's type as an extension, lowercase, without a dot: its file_type, else its name's. */
export function fileTypeOf(deliverable: Pick<Deliverable, 'file_type' | 'file_name' | 'file_path'>): string {
  const type = deliverable.file_type || extensionOf(deliverable.file_name || deliverable.file_path)
  return type.trim().toLowerCase().replace(/^\./, '')
}

/** The text in a code fence longer than any run of backticks inside it, so it can't close early. */
export function fenced(text: string, language: string): string {
  // reduce, not Math.max(...runs): a 1 MB file can hold more runs than a call takes arguments.
  const longest = (text.match(/`+/g) ?? []).reduce((most, run) => Math.max(most, run.length), 0)
  const fence = '`'.repeat(Math.max(MIN_FENCE, longest + 1))
  const info = CODE_LANGUAGE.test(language) ? language : ''
  return `${fence}${info}\n${text}\n${fence}`
}

function textView(content: string, asMarkdown: boolean, fileType: string, truncated: boolean): ContentView {
  if (!content.trim()) return { kind: 'empty' }
  return { kind: 'text', markdown: asMarkdown ? content : fenced(content, fileType), truncated }
}

/** How the Deliverable's content shows on its page. */
export function contentView(deliverable: Deliverable): ContentView {
  const url = deliverableFileUrl(deliverable)
  const kind = kindOf(deliverable)
  if (kind === 'image' || kind === 'video') {
    return url ? { kind, url } : { kind: 'file', reason: 'unsupported', url }
  }
  const fileType = fileTypeOf(deliverable)
  const binary = BINARY_TYPES.has(fileType)
  const content = typeof deliverable.content === 'string' ? deliverable.content : null
  if (content !== null && !binary) {
    const asMarkdown = MARKDOWN_KINDS.has(kind) || MARKDOWN_TYPES.has(fileType)
    return textView(content, asMarkdown, fileType, deliverable.content_truncated === true)
  }
  const unreadable = content === null && Boolean(deliverable.content_error) && !binary
  return { kind: 'file', reason: unreadable ? 'unreadable' : 'unsupported', url }
}

