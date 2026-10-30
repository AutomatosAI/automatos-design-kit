import { CHAT_HREF, HostLink } from '@automatos/theme-sdk'

import { Auto } from '../art/auto'
import type { Shelf } from './use-shelf'
import { Grid } from './tile'
import styles from './deliverables.module.css'
import ui from '../ui/ui.module.css'

/**
 * What the shelf shows under its pills: a line while the first page loads (busy, with no made-up tiles), the
 * failure in words with Try again, Auto and the way to the chat while there are no Deliverables at all, a line and
 * Show all when the search or the kind leaves none, or the grid with Show more while the host has more pages.
 */

export const GRID_LABEL = 'Your Deliverables'
export const LOADING = 'Loading your Deliverables…'
export const FAILED = "Couldn't load your Deliverables."
export const RETRY = 'Try again'
export const EMPTY_LINE = 'No Deliverables yet. Ask Auto for one.'
export const GO_TO_CHAT = 'Go to chat'
export const SHOW_ALL = 'Show all'
export const MORE = 'Show more'
export const MORE_LOADING = 'Loading more…'
export const MORE_FAILED = "Couldn't load more."

/** "Nothing matches “brief”." for a search; "No Reports yet." for a kind alone. */
export function noMatchLine(search: string, kindLabel: string | null): string {
  const words = search.trim()
  if (words) return `Nothing matches “${words}”.`
  return `No ${kindLabel ?? 'Deliverables'} yet.`
}

function Failed({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <div className={styles.state} role="alert">
      <p className={ui.note}>{FAILED}</p>
      <button type="button" className={ui.secondary} onClick={onRetry}>{RETRY}</button>
    </div>
  )
}

function Empty() {
  return (
    <div className={styles.state}>
      <Auto state="idle" size={120} />
      <p className={styles.stateLine}>{EMPTY_LINE}</p>
      <HostLink href={CHAT_HREF} className={ui.button}>{GO_TO_CHAT}</HostLink>
    </div>
  )
}

function NoMatch({ line, onShowAll }: { readonly line: string; readonly onShowAll: () => void }) {
  return (
    <div className={styles.state}>
      <p className={styles.stateLine}>{line}</p>
      <button type="button" className={ui.secondary} onClick={onShowAll}>{SHOW_ALL}</button>
    </div>
  )
}

function More({ shelf }: { readonly shelf: Shelf }) {
  return (
    <div className={styles.more}>
      {shelf.moreFailed && <p className={ui.note} role="alert">{MORE_FAILED}</p>}
      {shelf.moreFailed && <button type="button" className={ui.secondary} onClick={shelf.retry}>{RETRY}</button>}
      {shelf.hasMore && !shelf.moreFailed && (
        <button type="button" className={ui.secondary} onClick={shelf.more} disabled={shelf.loadingMore}>
          {shelf.loadingMore ? MORE_LOADING : MORE}
        </button>
      )}
    </div>
  )
}

export interface ResultsProps {
  readonly shelf: Shelf
  readonly now: number
  /** The line for no match; null while nothing narrows the shelf (no search, every kind). */
  readonly noMatch: string | null
  readonly onShowAll: () => void
  readonly onOpen: (id: string) => void
}

function Ready({ shelf, now, noMatch, onShowAll, onOpen }: ResultsProps) {
  if (shelf.view.status !== 'ready') return null
  if (shelf.view.items.length === 0) return noMatch === null ? <Empty /> : <NoMatch line={noMatch} onShowAll={onShowAll} />
  return (
    <>
      <Grid items={shelf.view.items} now={now} onOpen={onOpen} />
      <More shelf={shelf} />
    </>
  )
}

export function Results(props: ResultsProps) {
  const { status } = props.shelf.view
  const busy = status === 'loading' || props.shelf.loadingMore
  return (
    <section className={styles.results} aria-label={GRID_LABEL} aria-busy={busy ? true : undefined}>
      {status === 'loading' && <p className={ui.note} role="status">{LOADING}</p>}
      {status === 'failed' && <Failed onRetry={props.shelf.retry} />}
      <Ready {...props} />
    </section>
  )
}
