/**
 * Home, the chat screen (the app's src/chat/screens/HomeScreen.tsx and ChatFrame.tsx at the Automatos Go commit
 * packages/theme-cli's README names): the slim header on the --secondary chrome under the status bar, a 1 pt rule
 * under it (HeaderBar.tsx :21-:47), with the sail and 'automatos' in Newsreader 17 and the one menu button with its
 * needs-you badge beside the glyph (HomeHeader.tsx :32-:80, MenuButton.tsx :24-:51); the needs strip ('NEEDS YOU · N'
 * in the accent, 'Command Centre →', the 214 pt cards: NeedsStrip.tsx :21-:96); the thread (thread.tsx); and the
 * composer, its card ground running under the home indicator (Composer.tsx, ChatFrame.tsx :33).
 */
import type { CSSProperties } from 'react'
import { PHONE } from '../frame.tsx'
import { Composer } from './composer.tsx'
import { APP_COPY, NEEDS } from './copy.ts'
import { painted, pressHandlers, useGoPaint, usePress } from './paint.tsx'
import { Card, CountBadge, Icon, SailMark, SPACE, StatusPip } from './primitives.tsx'
import { GoText } from './text.tsx'
import { Thread } from './thread.tsx'

/** HomeHeader's numbers: a 44 pt row, the mark 20 pt high; the menu's 44 pt box, its 22 pt glyph (menu.ts HEADER). */
const HEADER = Object.freeze({ row: 44, mark: 20, menuBox: 44, menuIcon: 22 })
const NEED_CARD_WIDTH = 214
const NEEDS_TOTAL = 3
/** Button sm (variants.ts BUTTON_SIZES): 30 tall, 12 pt in, its label Body 5 at 500. */
const SMALL_BUTTON = Object.freeze({ height: 30, paddingX: SPACE.s5, weight: 500 })

const GHOST_BASE: CSSProperties = Object.freeze({
  backgroundColor: 'transparent', borderWidth: 0, cursor: 'pointer', appearance: 'none', margin: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center', borderRadius: 6,
})

function MenuButton() {
  const paint = useGoPaint()
  const press = usePress()
  const layout: CSSProperties = { ...GHOST_BASE, minWidth: HEADER.menuBox, minHeight: HEADER.menuBox, padding: `0 ${SPACE.s2}px`, gap: SPACE.s1 }
  return (
    <button type="button" aria-label={`${APP_COPY.menu}, ${NEEDS_TOTAL} need you`} {...pressHandlers(press)}
      {...painted(paint, 'menuButton', layout, press.pressed ? 'pressed' : 'rest')}>
      <Icon name="menu" size={HEADER.menuIcon} />
      <CountBadge count={NEEDS_TOTAL} />
    </button>
  )
}

function HeaderBar() {
  const paint = useGoPaint()
  const layout: CSSProperties = { paddingTop: PHONE.top, borderBottomWidth: 1, borderBottomStyle: 'solid', flexShrink: 0 }
  return (
    <header {...painted(paint, 'headerBar', layout)}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: HEADER.row, paddingLeft: SPACE.s7, paddingRight: SPACE.s2, gap: SPACE.s2 }}>
        <div role="heading" aria-level={1} aria-label="Automatos" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: SPACE.s2 }}>
          <SailMark height={HEADER.mark} colour={paint.colours.foreground} />
          <GoText role="threadTitle2" lines={1}>{APP_COPY.wordmark}</GoText>
        </div>
        <MenuButton />
      </div>
    </header>
  )
}

function GhostButton({ label, children }: { readonly label: string; readonly children: string }) {
  const paint = useGoPaint()
  const press = usePress()
  const layout: CSSProperties = { ...GHOST_BASE, minHeight: SMALL_BUTTON.height, padding: `0 ${SMALL_BUTTON.paddingX}px` }
  const part = painted(paint, 'ghostButton', layout, press.pressed ? 'pressed' : 'rest')
  return (
    <button type="button" aria-label={label} {...pressHandlers(press)} {...part}>
      <GoText role="body5" weight={SMALL_BUTTON.weight} colour={String(part.style.color)}>{children}</GoText>
    </button>
  )
}

function NeedsStrip() {
  const paint = useGoPaint()
  const layout: CSSProperties = {
    borderBottomWidth: 1, borderBottomStyle: 'solid', padding: `${SPACE.s5}px 0`, display: 'flex', flexDirection: 'column',
    gap: SPACE.s3, flexShrink: 0,
  }
  return (
    <section aria-label={APP_COPY.needsHeading(NEEDS_TOTAL)} {...painted(paint, 'needsStrip', layout)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${SPACE.s7}px`, gap: SPACE.s3 }}>
        <GoText role="label" tone="accent" as="h2">{APP_COPY.needsHeading(NEEDS_TOTAL)}</GoText>
        <GhostButton label="Open the Command Centre">{APP_COPY.commandCentreLink}</GhostButton>
      </div>
      <div style={{ display: 'flex', gap: SPACE.s3, padding: `0 ${SPACE.s7}px`, overflowX: 'auto' }}>
        {NEEDS.map((card) => (
          <Card key={card.title} label={card.title} style={{ width: NEED_CARD_WIDTH, flexShrink: 0, padding: SPACE.s4, gap: SPACE.s1 }}>
            <StatusPip status={card.status} word={card.word} />
            <GoText role="title6" lines={2}>{card.title}</GoText>
            <GoText role="label" tone="muted" lines={1}>{card.meta}</GoText>
          </Card>
        ))}
      </div>
    </section>
  )
}

/** Home: the header, the needs strip, the thread and the composer. */
export function ChatScreen() {
  const paint = useGoPaint()
  return (
    <>
      <HeaderBar />
      <NeedsStrip />
      <Thread />
      <Composer />
      <div aria-hidden="true" {...painted(paint, 'composerInset', { height: PHONE.bottom, flexShrink: 0 })} />
    </>
  )
}
