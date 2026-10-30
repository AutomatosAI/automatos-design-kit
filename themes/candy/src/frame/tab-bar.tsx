import { HostLink, useHostPathname, VoiceButton } from '@automatos/theme-sdk'

import { activeMenuId, AGENTS_ITEM, CHAT_ITEM, DELIVERABLES_ITEM, TODAY_ITEM } from './menu'
import styles from './phone.module.css'
import ui from '../ui/ui.module.css'

/**
 * The phone's floating tab bar (the design's P1, P3, P4): a pill 18 px from each side holding Today, Chat, the host's
 * voice button raised in the middle (quick ask, hold to talk), Shelf and Team. Each tab is a 56 px circle with a dot
 * and a word; the page on screen fills with the accent and is aria-current. The voice button is the host's, placed in
 * a white surround with an accent ring drawn behind it, never over it, so its caption and Stop show as the host draws
 * them. The bar floats above the host's AI label's corner, never over it.
 */

export const TABS_LABEL = 'Candy tabs'

const TABS = [
  { item: TODAY_ITEM, word: 'Today', set: 1 },
  { item: CHAT_ITEM, word: 'Chat', set: 2 },
  { item: DELIVERABLES_ITEM, word: 'Shelf', set: 3 },
  { item: AGENTS_ITEM, word: 'Team', set: 1 },
] as const

function Tab({ tab, current }: { readonly tab: (typeof TABS)[number]; readonly current: boolean }) {
  return (
    <HostLink href={tab.item.href} className={styles.tab} aria-current={current ? 'page' : undefined}>
      <span className={styles.tabDot} data-set={tab.set} aria-hidden="true" />
      <span className={styles.tabWord}>{tab.word}</span>
    </HostLink>
  )
}

export function TabBar() {
  const activeId = activeMenuId(useHostPathname())
  const [today, chat, shelf, team] = TABS
  return (
    <nav className={styles.tabBar} aria-label={TABS_LABEL}>
      <Tab tab={today} current={activeId === today.item.id} />
      <Tab tab={chat} current={activeId === chat.item.id} />
      <div className={styles.voice}>
        <span className={styles.voiceRing} aria-hidden="true" />
        <div className={`${ui.host} ${styles.voiceSlot}`}>
          <VoiceButton size="lg" hotkey={null} />
        </div>
      </div>
      <Tab tab={shelf} current={activeId === shelf.item.id} />
      <Tab tab={team} current={activeId === team.item.id} />
    </nav>
  )
}
