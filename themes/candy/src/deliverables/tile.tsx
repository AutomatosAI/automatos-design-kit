import type { MouseEvent } from 'react'
import { HostLink, useMediaPreferences } from '@automatos/theme-sdk'
import type { Deliverable } from '@automatos/theme-sdk'

import { initialOf } from '../ui/sets'
import { deliverableHref, isDeliverableId } from './links'
import { kindOf, kindWord, narrowLine, setOfKind, tileLabel, tileLine, titleOf } from './shelf'
import styles from './deliverables.module.css'
import ui from '../ui/ui.module.css'

/**
 * The shelf's grid: four tiles across (two below 1024 px, one below 375 px), newest first. Each tile is a window
 * holding its kind's card gradient with the kind's initial in a white circle and its word in a white pill, then the
 * title and "agent · source · day". A tile is the Deliverable's own link (/deliverables?deliverable=<id>, so a new tab
 * or a copied link opens it), and a plain click or Enter opens its sheet right here instead. It lifts on hover, never
 * under reduced motion.
 */

/** The attribute the shelf finds a tile by, to put the focus back on it when its sheet closes. */
export const TILE_ATTRIBUTE = 'data-deliverable'

const MAIN_BUTTON = 0

/** A plain click (or Enter): no new tab or window asked for. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === MAIN_BUTTON && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function TileFace({ item, now }: { readonly item: Deliverable; readonly now: number }) {
  const kind = kindOf(item)
  const set = setOfKind(kind)
  const word = kindWord(kind)
  return (
    <>
      <span className={`${ui.card} ${styles.block}`} data-set={set}>
        <span className={styles.initial} data-set={set} aria-hidden="true">{initialOf(word)}</span>
        <span className={styles.badge} data-set={set}>{word}</span>
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileTitle}>{titleOf(item)}</span>
        <span className={styles.tileLine}>{tileLine(item, now)}</span>
        <span className={styles.narrowLine}>{narrowLine(item, now)}</span>
      </span>
    </>
  )
}

interface TileProps {
  readonly item: Deliverable
  readonly now: number
  readonly onOpen: (id: string) => void
}

function Tile({ item, now, onOpen }: TileProps) {
  const className = `${ui.window} ${ui.lift} ${styles.tile}`
  if (!isDeliverableId(item.id)) {
    return (
      <div className={className} role="group" aria-label={tileLabel(item, now)}>
        <TileFace item={item} now={now} />
      </div>
    )
  }
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    onOpen(item.id)
  }
  return (
    <HostLink href={deliverableHref(item.id)} className={className} aria-label={tileLabel(item, now)} onClick={open} {...{ [TILE_ATTRIBUTE]: item.id }}>
      <TileFace item={item} now={now} />
    </HostLink>
  )
}

export interface GridProps {
  readonly items: readonly Deliverable[]
  readonly now: number
  readonly onOpen: (id: string) => void
}

export function Grid({ items, now, onOpen }: GridProps) {
  const { reducedMotion } = useMediaPreferences()
  return (
    <ul className={styles.grid} data-still={reducedMotion ? 'true' : undefined}>
      {items.map((item) => (
        <li key={item.id} className={styles.cell}>
          <Tile item={item} now={now} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}
