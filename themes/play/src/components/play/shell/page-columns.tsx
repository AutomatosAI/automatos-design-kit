import type { ReactNode } from 'react'

import { usePhoneLayout } from '../../../lib/play/phone-layout'
import styles from './page-columns.module.css'

/**
 * PRD-260 §4 — a Play page's columns inside Play's frame (mock 01), ported
 * from Automatos Play's components/shell/PageColumns.tsx: the main column,
 * and optionally the mascot column with Auto and his caption. The frame is
 * viewport-bound, so each column fills its height and the main one scrolls.
 *
 * Play 1.2.0: on a phone (lib/play/phone-layout.ts) there is no room for a mascot column, so the page is its main
 * column alone, as in the Ember design's 390 screens; the chat draws Auto beside his caption over the message box
 * instead (play-chat-view.tsx), and the phone's Conversations, a utility screen, draws none.
 */

export interface PageColumnsProps {
  readonly children: ReactNode
  /** The right column: <MascotColumn> with Auto. None on a page where Auto stands elsewhere. */
  readonly mascot?: ReactNode
}

export function PageColumns({ children, mascot }: PageColumnsProps) {
  const phone = usePhoneLayout()
  return (
    <div className={styles.columns}>
      <div className={styles.main}>{children}</div>
      {phone ? null : mascot}
    </div>
  )
}

export interface PageHeaderProps {
  readonly title: string
  /** A quiet line at the right: a date, a count. */
  readonly meta?: string
}

export function PageHeader({ title, meta }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>{title}</h1>
      {meta && <span className={styles.pageMeta}>{meta}</span>}
    </div>
  )
}

export function MascotColumn({ children }: { readonly children: ReactNode }) {
  return (
    <aside className={styles.mascotColumn} aria-label="Auto">
      {children}
    </aside>
  )
}
