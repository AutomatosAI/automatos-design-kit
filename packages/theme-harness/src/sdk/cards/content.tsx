/**
 * PRD-261 B-02c: stand-ins for SDK cards FilePreview, MarkdownView and MadeBy. They mirror core's
 * frontend/lib/theme-sdk/host-cards/content.tsx (101a0bf33f64fb4f89af81b4293415be60b661ac). MadeBy says it as core
 * does (components/workspace/gallery-view/made-by.ts). FilePreview names the preview it would draw (the type given,
 * else inferred from the file name) and shows text content as it is, or the API path of a binary file; it fetches
 * nothing. MarkdownView shows its text as it is, read as no Markdown and no HTML, so a test reads the words the host
 * would render. Each root carries data-protected-surface.
 */
import type { FilePreviewType } from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')

/** made-by.ts:11-23: where a Deliverable came from, named when no agent made it. */
const MADE_BY_SOURCE: Readonly<Record<string, string>> = Object.freeze({
  social_post: 'Socials',
  upload: 'Uploaded',
  mission: 'Mission',
  playbook: 'Playbook',
  heartbeat: 'Heartbeat',
  task: 'Task',
  chat: 'Chat',
  agent_output: 'Generated',
  document: 'Templates',
  trigger: 'Trigger',
})
export const MADE_BY_FALLBACK = 'Unknown agent'
export const FILE_PREVIEW_LABEL = 'File preview'
const DEFAULT_DENSITY = 'default'

/** The preview a file's extension asks for (FilePreview infers it so when no type is given). */
const PREVIEW_BY_EXTENSION: Readonly<Record<string, FilePreviewType>> = Object.freeze({
  txt: 'text',
  md: 'markdown',
  csv: 'csv',
  json: 'json',
  html: 'html',
  htm: 'html',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mp3: 'audio',
  wav: 'audio',
  docx: 'docx',
  xlsx: 'xlsx',
  py: 'code',
  ts: 'code',
  js: 'code',
})
const UNKNOWN_PREVIEW: FilePreviewType = 'binary'

/** made-by.ts:25: the agent that made it, else where it came from, else "Unknown agent". */
export function madeBy(agentName: string | null | undefined, sourceType: string | null | undefined): string {
  if (agentName) return agentName
  const named = sourceType && Object.prototype.hasOwnProperty.call(MADE_BY_SOURCE, sourceType) ? MADE_BY_SOURCE[sourceType] : undefined
  return named || MADE_BY_FALLBACK
}

function previewTypeOf(filename: string | undefined): FilePreviewType {
  const extension = filename?.split('.').pop()?.toLowerCase() ?? ''
  return Object.prototype.hasOwnProperty.call(PREVIEW_BY_EXTENSION, extension) ? (PREVIEW_BY_EXTENSION[extension] ?? UNKNOWN_PREVIEW) : UNKNOWN_PREVIEW
}

/** cards.FilePreview: the preview it would draw, and the text or the file's API path. */
export const FilePreview: Sdk['FilePreview'] = function FilePreview({ content, url, previewType, filename, className }) {
  const type = previewType ?? previewTypeOf(filename)
  return (
    <figure data-protected-surface="file-preview" data-preview-type={type} aria-label={filename ?? FILE_PREVIEW_LABEL} className={className}>
      {content === undefined ? <p>{url}</p> : <pre>{content}</pre>}
    </figure>
  )
}

/** cards.MarkdownView: the text as it is (no Markdown, no HTML), at the density asked for. */
export const MarkdownView: Sdk['MarkdownView'] = function MarkdownView({ children, density = DEFAULT_DENSITY, className }) {
  return (
    <div data-protected-surface="markdown-view" data-density={density} className={className}>
      {children}
    </div>
  )
}

/** cards.MadeBy: who made a Deliverable, in the host's words. */
export const MadeBy: Sdk['MadeBy'] = function MadeBy({ agentName, sourceType, className }) {
  return (
    <span data-protected-surface="made-by" className={className}>
      {madeBy(agentName, sourceType)}
    </span>
  )
}
