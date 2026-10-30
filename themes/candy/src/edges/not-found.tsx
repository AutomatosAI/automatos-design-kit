import { CHAT_HREF, HostLink } from '@automatos/theme-sdk'

import { Auto } from '../art/auto'
import { useLookStyle } from '../frame/look-vars'
import { TODAY_HREF } from '../routes'
import { THEME_HEADING } from '../theme'
import styles from './edges.module.css'
import ui from '../ui/ui.module.css'

/**
 * notFound@1: Candy's 404, which the host draws for a path it has no page for, on its own (no frame around it). So it
 * lays its own ground (the page's aura, the band across the top) and takes the look's roundness itself, then shows
 * one window: Auto lost (a picture; the words say what happened), the title, one line, and two ways back, to Today
 * and to the chat with Auto.
 */

export const NOT_FOUND_TITLE = "This page isn't here"
export const NOT_FOUND_LINE = 'The link may be old, or the page may have moved. Let’s get you back.'
export const BACK_TO_TODAY = 'Back to Today'
export const CHAT_WITH_AUTO = 'Chat with Auto'
export const LOST_AUTO_SIZE = 140

export function NotFound() {
  return (
    <div className={styles.screen} style={useLookStyle()}>
      <div className={styles.band} aria-hidden="true" />
      <main className={`${ui.window} ${styles.lost}`}>
        <Auto state="lost" size={LOST_AUTO_SIZE} />
        <h1 className={styles.title} tabIndex={-1} {...THEME_HEADING}>
          {NOT_FOUND_TITLE}
        </h1>
        <p className={styles.line}>{NOT_FOUND_LINE}</p>
        <div className={styles.ways}>
          <HostLink href={TODAY_HREF} className={ui.button}>
            {BACK_TO_TODAY}
          </HostLink>
          <HostLink href={CHAT_HREF} className={`${ui.secondary} ${styles.outlined}`}>
            {CHAT_WITH_AUTO}
          </HostLink>
        </div>
      </main>
    </div>
  )
}
