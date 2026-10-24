// After themes/play/src/components/play/chat/play-markdown.tsx (Play 1.1.1): Auto's answer through the host's
// Markdown renderer, with Play's rules for untrusted model output.
import type { ComponentPropsWithoutRef } from 'react'
import { MarkdownView } from '@automatos/theme-sdk'

import styles from './reply.module.css'

/**
 * Auto's answer as Markdown, through the host's sanitising renderer (the SDK's MarkdownView), with Play's rules for
 * model output on top: raw HTML in the text is dropped (skipHtml), never printed as literal tags; a link opens in a
 * new tab without handing it this window; an image shows as its alt text, since an image's address is fetched with
 * no click and could carry the chat's words to any host; and a fenced block is a plain <pre>, so HUD's own rules
 * set it.
 */

function ExternalLink({ href, title, children }: ComponentPropsWithoutRef<'a'>) {
  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function ImageAsText({ alt }: ComponentPropsWithoutRef<'img'>) {
  return alt ? <span className={styles.imageAlt}>{alt}</span> : null
}

function PrintedPre({ children }: ComponentPropsWithoutRef<'pre'>) {
  return <pre>{children}</pre>
}

/** HUD's rules for untrusted Markdown. */
export const HUD_MARKDOWN_COMPONENTS = { a: ExternalLink, img: ImageAsText, pre: PrintedPre }

export function HudMarkdown({ text }: { readonly text: string }) {
  return (
    <MarkdownView density="compact" components={HUD_MARKDOWN_COMPONENTS} skipHtml className={styles.markdown}>
      {text}
    </MarkdownView>
  )
}
