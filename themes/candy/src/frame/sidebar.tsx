import { useCoreNav, useEdition, useHostPathname, useWorkspace } from '@automatos/theme-sdk'

import { Auto } from '../art/auto'
import { PauseToggle } from '../motion/pause-toggle'
import { THEME_NAME } from '../theme'
import { activeMenuId, buildMenu } from './menu'
import { MenuList } from './menu-list'
import styles from './frame.module.css'

/**
 * The desktop's sidebar (the design's Candy Sidebar): the Candy mark and name, Auto's card ("Here when you need
 * me"), the menu, then at its foot the Pause control and the workspace with its edition and plan. A window of its own
 * (r corners, tinted shadow) that stays in view while the page scrolls.
 */

export const SIDEBAR_LABEL = 'Candy menu'
export const AUTO_LINE = 'Here when you need me'
const EDITION_WORDS = { local: 'Local', saas: 'Hosted' } as const

export function Mark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <span className={styles.markOne} />
      <span className={styles.markTwo} />
    </span>
  )
}

function Workspace() {
  const { workspace } = useWorkspace()
  const edition = EDITION_WORDS[useEdition()]
  if (workspace === null) return null
  const plan = workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)
  return (
    <div className={styles.workspace}>
      <p className={styles.workspaceName}>{workspace.name}</p>
      <p className={styles.workspacePlan}>{`${edition} · ${plan}`}</p>
    </div>
  )
}

export function Sidebar() {
  const nav = useCoreNav()
  const activeId = activeMenuId(useHostPathname())
  return (
    <nav className={styles.sidebar} aria-label={SIDEBAR_LABEL}>
      <p className={styles.brand}>
        <Mark />
        <span className={styles.brandName}>{THEME_NAME}</span>
      </p>
      <div className={styles.autoCard}>
        <Auto state="idle" size={54} />
        <div className={styles.autoText}>
          <p className={styles.autoName}>Auto</p>
          <p className={styles.autoLine}>{AUTO_LINE}</p>
        </div>
      </div>
      <MenuList menu={buildMenu(nav)} activeId={activeId} />
      <div className={styles.spacer} />
      <PauseToggle />
      <Workspace />
    </nav>
  )
}
