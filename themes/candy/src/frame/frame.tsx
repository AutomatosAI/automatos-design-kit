import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { HeaderUtilities, useHealth, useHostPathname } from '@automatos/theme-sdk'

import { Asleep } from '../edges/asleep'
import { useMotion } from '../motion/use-motion'
import { bandOf, ownsHeader } from './menu'
import { PhoneBar, PhoneMenu } from './phone-bar'
import { usePhoneLayout } from './phone-layout'
import { Sidebar } from './sidebar'
import { TabBar } from './tab-bar'
import { useUtilitiesRoom } from './use-room'
import styles from './frame.module.css'
import ui from '../ui/ui.module.css'

/**
 * frame@1: Candy around every page while it is the style and the window is at least 360 px wide.
 *
 * At 1024 px and up: the sidebar on the left, the band behind the top of the page (taller on Today, shorter on the
 * chat), the host's header utilities at the top right, and the page. Candy's own pages draw their header row beside
 * the utilities; the host's pages start under them. Below 1024 px it is the design's phone: a top bar (menu, mark,
 * utilities), the page, and the floating tab bar with the host's voice button (not on the chat, which has its own).
 *
 * The frame owns the backend's health poll (asleep@1): while the backend is down the page gives way to the asleep
 * screen. The page keeps its place in the tree in both
 * layouts. The foot of the window stays clear: the host draws its AI label there, over the page's ground.
 */

export interface FrameProps {
  readonly children?: ReactNode
  readonly fullBleed?: boolean
  readonly autoWidget?: ReactNode
}

/** The phone's menu: open until a page is chosen or the page changes. */
function usePhoneMenu(phone: boolean) {
  const [open, setOpen] = useState(false)
  const pathname = useHostPathname()
  useEffect(() => setOpen(false), [pathname, phone])
  return { open: phone && open, toggle: () => setOpen((was) => !was), close: () => setOpen(false) }
}

function Page({ children, fullBleed, ownHeader }: { readonly children?: ReactNode; readonly fullBleed: boolean; readonly ownHeader: boolean }) {
  const health = useHealth({ poll: true })
  const asleep = health.connection === 'down'
  return (
    <main className={fullBleed && !asleep ? styles.fullBleed : styles.page} data-header={ownHeader ? 'own' : 'host'} tabIndex={-1}>
      {asleep ? <Asleep health={health} /> : children}
    </main>
  )
}

export function Frame({ children, fullBleed = false, autoWidget }: FrameProps) {
  const phone = usePhoneLayout()
  const menu = usePhoneMenu(phone)
  const menuId = useId()
  const pathname = useHostPathname()
  const band = bandOf(pathname)
  const { moving } = useMotion()
  const utilities = useRef<HTMLDivElement>(null)
  const style = useUtilitiesRoom(utilities)
  return (
    <div className={styles.frame} data-layout={phone ? 'phone' : 'desktop'} data-band={band} data-moving={moving ? 'true' : undefined} style={style}>
      <div className={styles.band} aria-hidden="true" />
      {phone ? <PhoneBar open={menu.open} menuId={menuId} onMenu={menu.toggle} /> : <Sidebar />}
      <div className={styles.column} hidden={menu.open}>
        {!phone && (
          <div ref={utilities} className={`${ui.host} ${styles.utilities}`}>
            <HeaderUtilities />
          </div>
        )}
        <Page fullBleed={fullBleed} ownHeader={ownsHeader(pathname)}>
          {children}
        </Page>
      </div>
      {menu.open ? <PhoneMenu id={menuId} onClose={menu.close} /> : null}
      {phone && band !== 'chat' && !menu.open ? <TabBar /> : null}
      {autoWidget}
    </div>
  )
}
