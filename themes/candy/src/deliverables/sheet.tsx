import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, RefObject } from 'react'
import {
  deliverableDownloadUrl,
  deliverableFilename,
  FilePreview,
  HostLink,
  MadeBy,
  MarkdownView,
  useDeliverable,
  useFileDownload,
} from '@automatos/theme-sdk'
import type { Deliverable, DeliverableQuery } from '@automatos/theme-sdk'

import { initialOf } from '../ui/sets'
import { dayWords } from '../ui/when'
import { contentView } from './content'
import type { ContentView } from './content'
import { explorerHref } from './links'
import { kindOf, kindWord, setOfKind, titleOf } from './shelf'
import { useDialogKeys } from './use-dialog-keys'
import styles from './sheet.module.css'
import ui from '../ui/ui.module.css'

/**
 * One Deliverable in a sheet over the shelf: its kind's gradient and initial, its title, who made it (the host's
 * MadeBy) and its day, its summary, its content through the host's renderers (Markdown through MarkdownView, anything
 * else through FilePreview), Download (the host's download, with the caller's token) and its place in the host's
 * Explorer. The title, kind and maker show from the shelf's row at once; the content follows. A modal dialog: it
 * takes the focus on its title, Escape, Close or a click beside it close it, and the shelf puts the focus back.
 */

export const CLOSE = 'Close'
export const OPENING = 'Opening it…'
export const FAILED = "Couldn't open this Deliverable."
export const RETRY = 'Try again'
export const EMPTY = 'This Deliverable is empty.'
export const TRUNCATED = 'This is the first part: the rest is too long to show here.'
export const UNREADABLE = "Automatos couldn't read this Deliverable."
export const NOTHING = 'There is nothing to show here yet.'
export const DOWNLOAD = 'Download'
export const DOWNLOADING = 'Downloading…'
export const DOWNLOAD_FAILED = "Couldn't download it. Try again in a moment."
export const EXPLORER = 'Open in Explorer'
/** The sheet's title until the Deliverable's own is known. */
const SHEET_TITLE = 'Deliverable'

interface HeadProps {
  readonly item: Deliverable | null
  readonly titleId: string
  readonly heading: RefObject<HTMLHeadingElement | null>
  readonly now: number
  readonly onClose: () => void
}

function Head({ item, titleId, heading, now, onClose }: HeadProps) {
  const kind = item === null ? null : kindOf(item)
  const set = kind === null ? 1 : setOfKind(kind)
  const day = item === null ? null : dayWords(item.created_at, now)
  return (
    <div className={styles.head}>
      <span className={`${ui.card} ${styles.block}`} data-set={set} aria-hidden="true">
        <span className={styles.initial} data-set={set}>{initialOf(kind === null ? null : kindWord(kind))}</span>
      </span>
      <div className={styles.headText}>
        {kind !== null && <span className={styles.kind}>{kindWord(kind)}</span>}
        <h2 id={titleId} ref={heading} tabIndex={-1} className={styles.title}>
          {item === null ? SHEET_TITLE : titleOf(item)}
        </h2>
        {item !== null && (
          <p className={styles.meta}>
            <span className={ui.host}>
              <MadeBy agentName={item.agent_name} sourceType={item.source_type} />
            </span>
            {day && ` · ${day}`}
          </p>
        )}
      </div>
      <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={onClose}>
        {CLOSE}
      </button>
    </div>
  )
}

function Content({ view, filename }: { readonly view: ContentView; readonly filename: string }) {
  if (view.kind === 'markdown') {
    return (
      <div className={styles.document}>
        <MarkdownView skipHtml className={styles.prose}>{view.markdown}</MarkdownView>
        {view.truncated && <p className={ui.note}>{TRUNCATED}</p>}
      </div>
    )
  }
  if (view.kind === 'preview') {
    return (
      <div className={styles.document}>
        <div className={`${ui.host} ${styles.preview}`}>
          <FilePreview content={view.content ?? undefined} url={view.url ?? undefined} previewType={view.previewType ?? undefined} filename={filename} />
        </div>
        {view.truncated && <p className={ui.note}>{TRUNCATED}</p>}
      </div>
    )
  }
  if (view.kind === 'empty') return <p className={ui.note}>{EMPTY}</p>
  return <p className={ui.note}>{view.kind === 'unreadable' ? UNREADABLE : NOTHING}</p>
}

function Actions({ item }: { readonly item: Deliverable }) {
  const { download, downloading } = useFileDownload(DOWNLOAD_FAILED)
  const url = deliverableDownloadUrl(item)
  const filename = deliverableFilename(item)
  return (
    <div className={styles.actions}>
      {url !== null && (
        <button type="button" className={ui.button} onClick={() => void download(url, filename)} disabled={downloading}>
          {downloading ? DOWNLOADING : DOWNLOAD}
        </button>
      )}
      <HostLink href={explorerHref(item.file_path)} className={ui.quiet}>
        {EXPLORER}
      </HostLink>
    </div>
  )
}

function Body({ detail }: { readonly detail: DeliverableQuery }) {
  const full = detail.data?.success ? detail.data.deliverable : null
  if (full === null && detail.isLoading) return <p className={ui.note} role="status">{OPENING}</p>
  if (full === null) {
    return (
      <div className={styles.failed} role="alert">
        <p className={ui.note}>{FAILED}</p>
        <button type="button" className={ui.quiet} onClick={() => void detail.refetch()}>{RETRY}</button>
      </div>
    )
  }
  return (
    <>
      {full.summary && <p className={styles.summary}>{full.summary}</p>}
      <Content view={contentView(full)} filename={deliverableFilename(full)} />
      <Actions item={full} />
    </>
  )
}

export interface SheetProps {
  readonly id: string
  /** The shelf's row for it, shown while the whole Deliverable loads; null when the shelf hasn't loaded it. */
  readonly row: Deliverable | null
  readonly now: number
  readonly onClose: () => void
}

export function DeliverableSheet({ id, row, now, onClose }: SheetProps) {
  const detail = useDeliverable(id, true)
  const item = detail.data?.success ? detail.data.deliverable : row
  const titleId = useId()
  const box = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const onKeyDown = useDialogKeys(box, onClose)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const beside = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }
  return (
    <div className={styles.backdrop} onClick={beside}>
      <section ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={detail.isLoading ? true : undefined} className={`${ui.window} ${styles.sheet}`} onKeyDown={onKeyDown}>
        <Head item={item} titleId={titleId} heading={heading} now={now} onClose={onClose} />
        <Body detail={detail} />
      </section>
    </div>
  )
}
