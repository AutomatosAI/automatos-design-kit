import { HostLink, useHostPathname, VoiceButton } from '@automatos/theme-sdk'

import { activeMenuId, CHAT_ITEM, INVENTORY_ITEM, QUESTS_ITEM, type MenuItem } from './menu'
import styles from './handheld.module.css'
import ui from '../ui/ui.module.css'

/**
 * The handheld's controls under the screen: the D-pad, a styled nav of four named targets of 64 px (▲ Quests,
 * ◀ Chat, ▶ Inventory, ▼ Menu; the page on screen is aria-current, Menu says whether it is open), and the host's
 * voice button in a round arcade surround. The surround is drawn behind the button and never clips it: the host's
 * voice control (the "AI voice assistant" caption and Stop) shows under the button, uncovered. The button is placed
 * as the host draws it, talking into the conversation on screen, with no key of its own: on the handheld, Space
 * belongs to the focused control.
 */

export const DPAD_LABEL = 'Arcade navigation'
export const MENU_WORD = 'Menu'
export const VOICE_WORD = 'Voice'
export const BRAND = 'Automatos Arcade'

interface PadLinkProps {
  readonly item: MenuItem
  readonly arrow: string
  readonly place: 'up' | 'left' | 'right'
  readonly current: boolean
}

function PadLink({ item, arrow, place, current }: PadLinkProps) {
  return (
    <HostLink href={item.href} className={styles.pad} data-place={place} aria-current={current ? 'page' : undefined}>
      <span className={styles.padArrow} aria-hidden="true">
        {arrow}
      </span>
      {item.label}
    </HostLink>
  )
}

interface ControlsProps {
  readonly menuOpen: boolean
  readonly menuId: string
  readonly onMenu: () => void
}

export function DPad({ menuOpen, menuId, onMenu }: ControlsProps) {
  const active = menuOpen ? null : activeMenuId(useHostPathname())
  return (
    <nav className={styles.dpad} aria-label={DPAD_LABEL}>
      <PadLink item={QUESTS_ITEM} arrow="▲" place="up" current={active === QUESTS_ITEM.id} />
      <PadLink item={CHAT_ITEM} arrow="◀" place="left" current={active === CHAT_ITEM.id} />
      <span className={styles.padHub} aria-hidden="true" />
      <PadLink item={INVENTORY_ITEM} arrow="▶" place="right" current={active === INVENTORY_ITEM.id} />
      <button
        type="button"
        className={styles.pad}
        data-place="down"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={onMenu}
      >
        <span className={styles.padArrow} aria-hidden="true">
          ▼
        </span>
        {MENU_WORD}
      </button>
    </nav>
  )
}

export function Controls(props: ControlsProps) {
  return (
    <div className={styles.controls}>
      <p className={`${ui.label} ${styles.brand}`} aria-hidden="true">
        {BRAND}
      </p>
      <div className={styles.controlRow}>
        <DPad {...props} />
        <div className={styles.voice}>
          <div className={styles.surround}>
            <span className={styles.surroundRing} aria-hidden="true" />
            <div className={`${ui.host} ${styles.voiceSlot}`}>
              <VoiceButton size="lg" hotkey={null} />
            </div>
          </div>
          <p className={`${ui.label} ${styles.voiceWord}`} aria-hidden="true">
            {VOICE_WORD}
          </p>
        </div>
      </div>
    </div>
  )
}
