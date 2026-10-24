import { CHAT_HREF, HostLink } from '@automatos/theme-sdk'

import { THEME_NAME } from '../theme'
import styles from './edges.module.css'

/**
 * notFound@1: {{name}}'s 404, which the host draws for a path it has no page for, on its own (no frame around it):
 * the theme's name, what happened in one line, and one way back, to the chat.
 */

export const NOT_FOUND_TITLE = "This page isn't here"
export const NOT_FOUND_LINE = 'The link may be old, or the page may have moved.'
export const BACK_TO_CHAT = 'Back to chat'

export function NotFound() {
  return (
    <div className={styles.screen}>
      <p className={styles.wordmark}>{THEME_NAME}</p>
      <main className={styles.lost}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <h1 className={styles.title}>{NOT_FOUND_TITLE}</h1>
        <p className={styles.line}>{NOT_FOUND_LINE}</p>
        <HostLink href={CHAT_HREF} className={styles.back}>
          {BACK_TO_CHAT}
        </HostLink>
      </main>
    </div>
  )
}
