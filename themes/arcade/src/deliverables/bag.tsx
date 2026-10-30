import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CHAT_HREF,
  type Deliverable,
  DELIVERABLE_EXPLORER_HREF,
  DELIVERABLE_TAB_LABELS,
  DELIVERABLES_HREF,
  HostLink,
  useDeliverables,
  useWorkspace,
  visibleDeliverableTabs,
} from '@automatos/theme-sdk'

import { AutoSprite, ItemIcon } from '../art/pixel-art'
import { deliverableHref, isDeliverableId } from './links'
import { bagView, countLine, filtersOf, infoLine, type InventoryTab, itemDate, itemKind, REFRESH_MS, titleOf, typeWord, visibleTabs } from './inventory'
import styles from './inventory.module.css'
import ui from '../ui/ui.module.css'

/**
 * The bag (the design's Inventory): tabs ALL, REPORTS, DOCUMENTS, IMAGES and POSTS over a grid of item slots, newest
 * first, each a pixel icon by its type, its title and its date. The ▶ cursor follows the pointer and the focus, the
 * info window names the item under it, and a slot opens the item's own window. MORE asks for the next page. The
 * host's other sections of Deliverables (Blogs, Templates, Brand kit, Socials while offered, the Explorer) stay the
 * host's pages, linked under the bag, so none is out of reach under Arcade.
 */

export const TABS_LABEL = 'Inventory filters'
export const BAG_LABEL = 'Inventory'
export const MORE = 'More'
export const LOADING = 'Opening your bag…'
export const FAILED = "Couldn't open your bag."
export const RETRY = 'Try again'
export const EMPTY_TITLE = 'Your bag is empty.'
export const EMPTY_LINE = 'Ask Auto for something and it lands here.'
export const GO_TO_CHAT = 'Go to chat'
export const EMPTY_INFO = 'Nothing in the bag yet.'
export const SECTIONS_LABEL = 'More in Deliverables'
const EXPLORER = 'Explorer'

function useBag(tab: InventoryTab) {
  const filters = useMemo(() => filtersOf(tab), [tab])
  const query = useDeliverables(filters, { refetchInterval: REFRESH_MS })
  const view = useMemo(() => bagView({ data: query.data, isError: query.isError }), [query.data, query.isError])
  const more = useCallback(() => void query.fetchNextPage(), [query])
  const retry = useCallback(() => void query.refetch(), [query])
  return { view, hasMore: query.hasNextPage === true, loadingMore: query.isFetchingNextPage, more, retry }
}

function Tabs({ tabs, selected, onSelect }: { readonly tabs: readonly InventoryTab[]; readonly selected: InventoryTab; readonly onSelect: (tab: InventoryTab) => void }) {
  return (
    <div className={styles.tabs} role="group" aria-label={TABS_LABEL}>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" className={styles.tab} aria-pressed={tab.id === selected.id} onClick={() => onSelect(tab)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function Slot({ item, now, picked, onPick }: { readonly item: Deliverable; readonly now: Date; readonly picked: boolean; readonly onPick: () => void }) {
  const date = itemDate(item.created_at, now)
  const type = typeWord(item)
  const content = (
    <>
      <span className={styles.slotHead}>
        <span>{type}</span>
        <span className={styles.slotCursor} aria-hidden="true">▶</span>
      </span>
      <span className={styles.slotIcon}>
        <ItemIcon kind={itemKind(item)} />
      </span>
      <span className={styles.slotTitle}>{titleOf(item)}</span>
      <span className={styles.slotDate}>{date}</span>
    </>
  )
  const label = [titleOf(item), type, date].filter(Boolean).join(', ')
  if (!isDeliverableId(item.id)) return <span className={styles.slot}>{content}</span>
  return (
    <HostLink href={deliverableHref(item.id)} className={styles.slot} data-picked={picked ? 'true' : undefined} aria-label={label} onMouseEnter={onPick} onFocus={onPick}>
      {content}
    </HostLink>
  )
}

function Empty() {
  return (
    <div className={styles.empty}>
      <AutoSprite state="sleeping" view="large" />
      <p className={ui.title}>{EMPTY_TITLE}</p>
      <p className={ui.note}>{EMPTY_LINE}</p>
      <HostLink href={CHAT_HREF} className={ui.button}>
        {GO_TO_CHAT}
      </HostLink>
    </div>
  )
}

function Sections({ socials }: { readonly socials: boolean }) {
  const tabs = visibleDeliverableTabs(socials).filter((tab) => tab !== 'outputs')
  const links = [
    ...tabs.map((tab) => ({ href: `${DELIVERABLES_HREF}?tab=${tab}`, label: DELIVERABLE_TAB_LABELS[tab] })),
    { href: DELIVERABLE_EXPLORER_HREF, label: EXPLORER },
  ]
  return (
    <nav className={styles.sections} aria-label={SECTIONS_LABEL}>
      <span className={ui.label}>{SECTIONS_LABEL}</span>
      {links.map((link) => (
        <HostLink key={link.href} href={link.href} className={styles.sectionLink}>
          {link.label}
        </HostLink>
      ))}
    </nav>
  )
}

interface GridProps {
  readonly items: readonly Deliverable[]
  readonly now: Date
  readonly picked: string | null
  readonly onPick: (id: string) => void
}

function Grid({ items, now, picked, onPick }: GridProps) {
  return (
    <ul className={styles.grid}>
      {items.map((item) => (
        <li key={item.id}>
          <Slot item={item} now={now} picked={picked === item.id} onPick={() => onPick(item.id)} />
        </li>
      ))}
    </ul>
  )
}

export function Bag({ now = new Date(), notice }: { readonly now?: Date; readonly notice?: string }) {
  const socials = useWorkspace().workspace?.socialsAvailable === true
  const tabs = visibleTabs(socials)
  const [tab, setTab] = useState<InventoryTab>(tabs[0])
  const { view, hasMore, loadingMore, more, retry } = useBag(tab)
  const [picked, setPicked] = useState<string | null>(null)
  const items = view.status === 'ready' ? view.items : []
  useEffect(() => setPicked(null), [tab])
  const shown = items.find((item) => item.id === picked) ?? items[0]
  return (
    <div className={styles.bag}>
      {notice && <p className={ui.note} role="status">{notice}</p>}
      <div className={styles.bagHead}>
        <Tabs tabs={tabs} selected={tab} onSelect={setTab} />
        {view.status === 'ready' && <span className={ui.aside}>{countLine(view.total)}</span>}
      </div>
      <section className={`${ui.window} ${styles.bagWindow}`} aria-label={BAG_LABEL} aria-busy={view.status === 'loading' ? true : undefined}>
        {view.status === 'loading' && <p className={ui.note}>{LOADING}</p>}
        {view.status === 'failed' && (
          <div className={styles.failed}>
            <p className={ui.alert}>{FAILED}</p>
            <button type="button" className={ui.secondary} onClick={retry}>{RETRY}</button>
          </div>
        )}
        {view.status === 'ready' && (items.length === 0 ? <Empty /> : <Grid items={items} now={now} picked={shown?.id ?? null} onPick={setPicked} />)}
        {hasMore && (
          <button type="button" className={`${ui.secondary} ${styles.more}`} onClick={more} disabled={loadingMore}>
            {MORE}
          </button>
        )}
      </section>
      <div className={`${ui.window} ${styles.info}`}>
        <span className={styles.infoCursor} aria-hidden="true">▶</span>
        <p className={styles.infoText}>{shown ? infoLine(shown, now) : EMPTY_INFO}</p>
      </div>
      <Sections socials={socials} />
    </div>
  )
}
