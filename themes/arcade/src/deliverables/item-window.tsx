import { useEffect } from 'react'
import {
  DELIVERABLES_HREF,
  fileDownloadUrl,
  HostLink,
  MarkdownView,
  useAuthenticatedBlobUrl,
  useDeliverable,
  useFileDownload,
  deliverableFilename,
} from '@automatos/theme-sdk'

import { ItemIcon } from '../art/pixel-art'
import { type ContentView, contentView } from './content'
import { itemDate, itemKind, madeBy, titleOf, typeWord } from './inventory'
import styles from './inventory.module.css'
import ui from '../ui/ui.module.css'

/**
 * One item of the bag, in its own window (the Inventory's answer to /deliverables?deliverable=<id>, the host's link
 * for one Deliverable): its icon, title, type, maker and date, its summary, and its content as the host reads it,
 * through the host's renderers (text through MarkdownView, a picture or a video fetched with the caller's token,
 * anything else with Download). BACK TO BAG returns to the grid.
 */

export const BACK = 'Back to bag'
export const OPENING = 'Opening the item…'
export const NOT_FOUND = "That item isn't in your bag."
export const EMPTY = 'This item is empty.'
export const TRUNCATED = 'This is the first part: the file is too long to show here in full.'
export const UNREADABLE = "Automatos couldn't read this file."
export const NO_PREVIEW = "Arcade can't show this item here."
export const DOWNLOAD = 'Download'
export const DOWNLOADING = 'Downloading…'
export const DOWNLOAD_FAILED = "Couldn't download the file. Try again in a moment."
const MEDIA_LOADING = 'Loading…'
const MEDIA_FAILED = "The file didn't load."

function Media({ kind, url, title }: { readonly kind: 'image' | 'video'; readonly url: string; readonly title: string }) {
  const { src, error } = useAuthenticatedBlobUrl(url)
  useEffect(() => {
    if (error) console.error(`[arcade] the ${kind} at ${url} didn't load:`, error)
  }, [error, kind, url])
  if (error) return <p className={ui.alert} role="alert">{MEDIA_FAILED}</p>
  if (!src) return <p className={ui.note} role="status">{MEDIA_LOADING}</p>
  if (kind === 'video') {
    return (
      <video src={src} controls preload="metadata" aria-label={title} className={styles.media}>
        <track kind="captions" />
      </video>
    )
  }
  return <img src={src} alt={title} className={styles.media} />
}

function FileCard({ message, url, filename }: { readonly message: string; readonly url: string | null; readonly filename: string }) {
  const { download, downloading } = useFileDownload(DOWNLOAD_FAILED)
  const file = url ? fileDownloadUrl(url) : null
  return (
    <div className={styles.fileCard}>
      <p className={ui.note}>{message}</p>
      {file && (
        <button type="button" className={ui.button} onClick={() => void download(file, filename)} disabled={downloading}>
          {downloading ? DOWNLOADING : DOWNLOAD}
        </button>
      )}
    </div>
  )
}

function Content({ view, title, filename }: { readonly view: ContentView; readonly title: string; readonly filename: string }) {
  if (view.kind === 'text') {
    return (
      <div className={styles.document}>
        <MarkdownView skipHtml className={styles.prose}>{view.markdown}</MarkdownView>
        {view.truncated && <p className={ui.note}>{TRUNCATED}</p>}
      </div>
    )
  }
  if (view.kind === 'empty') return <p className={ui.note}>{EMPTY}</p>
  if (view.kind === 'file') return <FileCard message={view.reason === 'unreadable' ? UNREADABLE : NO_PREVIEW} url={view.url} filename={filename} />
  return <Media kind={view.kind} url={view.url} title={title} />
}

function Back() {
  return (
    <HostLink href={DELIVERABLES_HREF} className={ui.secondary}>
      <span aria-hidden="true">◀</span> {BACK}
    </HostLink>
  )
}

export function ItemWindow({ id, now = new Date() }: { readonly id: string; readonly now?: Date }) {
  const { data, isLoading } = useDeliverable(id, true)
  const item = data?.success ? data.deliverable : null
  if (item === null) {
    return (
      <section className={`${ui.window} ${styles.itemWindow}`} aria-busy={isLoading ? true : undefined}>
        <p className={isLoading ? ui.note : ui.alert}>{isLoading ? OPENING : NOT_FOUND}</p>
        <Back />
      </section>
    )
  }
  const title = titleOf(item)
  const date = itemDate(item.created_at, now)
  return (
    <section className={`${ui.window} ${styles.itemWindow}`} aria-labelledby={`item-${item.id}`}>
      <div className={styles.itemHead}>
        <ItemIcon kind={itemKind(item)} />
        <div className={styles.itemHeadText}>
          <span className={ui.label}>{typeWord(item)}</span>
          <h1 id={`item-${item.id}`} className={styles.itemTitle}>{title}</h1>
          <span className={styles.itemMeta}>{[`made by ${madeBy(item)}`, date].filter(Boolean).join(' · ')}</span>
        </div>
        <Back />
      </div>
      {item.summary && <p className={styles.summary}>{item.summary}</p>}
      <Content view={contentView(item)} title={title} filename={deliverableFilename(item)} />
    </section>
  )
}
