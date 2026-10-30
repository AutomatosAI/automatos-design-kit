import { CHAT_HREF, HostLink } from '@automatos/theme-sdk'

import { AutoSprite } from '../art/pixel-art'
import { THEME_NAME } from '../theme'
import styles from './edges.module.css'
import ui from '../ui/ui.module.css'

/**
 * notFound@1: Arcade's 404, which the host draws for a path it has no page for, on its own (no frame around it):
 * Auto lost with a "?", what happened in one line, and one way back, to the chat.
 */

export const NOT_FOUND_TITLE = 'You wandered off the map'
export const NOT_FOUND_LINE = "This page isn't here. The link may be old, or the page may have moved."
export const BACK_TO_CHAT = 'Back to chat'

export function NotFound() {
  return (
    <div className={styles.screen}>
      <p className={`${ui.label} ${styles.wordmark}`}>{THEME_NAME}</p>
      <main className={`${ui.window} ${styles.lost}`}>
        <AutoSprite state="lost" view="small" />
        <h1 className={ui.title}>{NOT_FOUND_TITLE}</h1>
        <p className={ui.note}>{NOT_FOUND_LINE}</p>
        <HostLink href={CHAT_HREF} className={ui.button}>
          {BACK_TO_CHAT}
        </HostLink>
      </main>
    </div>
  )
}
