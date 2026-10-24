/**
 * The Command Centre (the app's app/(app)/cc/_layout.tsx and src/cc at the Automatos Go commit packages/theme-cli's
 * README names): the top bar on the --secondary chrome, back to Auto and the live word (TopBar.tsx :57-:77,
 * LiveWord.tsx :24-:63); the head, its dateline eyebrow, the title and the lede with its figures in mono and the needs
 * clause in the accent (Head.tsx :28-:59); the tabs on the page's ground, the active one in ink over a 2 pt accent rule
 * (TabStrip.tsx, cc/shell/chrome.ts :74-:95); and the Board: the filter pills, solid ink when chosen (variants.ts
 * :197-:209), over the ticket cards, the kind row with the status as dot and word, the serif title, the reason chip,
 * the tags and the agent (TicketCard.tsx :32-:141, cc/board/chrome.ts :10-:69).
 */
import type { CSSProperties } from 'react'
import { PIP_COLOURS } from '../../../src/phone/parts.ts'
import { PHONE } from '../frame.tsx'
import { APP_COPY, COMMAND_CENTRE, type FilterPill, type Ticket } from './copy.ts'
import { painted, pressHandlers, useGoPaint, usePress } from './paint.tsx'
import { Card, Chip, Icon, RADII, SPACE, StatusPip } from './primitives.tsx'
import { GoText } from './text.tsx'

/** chrome.ts LIVE_PULSE.dotSize, TOP_BAR, TAB_STRIP; Pill.tsx PILL_HEIGHT, DOT_SIZE and its Geist 500; TICKET_AGENT. */
const LIVE_DOT = 6
const TAB = Object.freeze({ height: 40, rule: 2, weight: 500 })
const PILL = Object.freeze({ height: 28, dot: 7, weight: 500 })
const AGENT = Object.freeze({ swatch: 8, gap: 5, weight: 500 })
const TICKET = Object.freeze({ paddingY: 11, paddingX: 13, gap: 7 })

function TopBar() {
  const paint = useGoPaint()
  const press = usePress()
  const bar: CSSProperties = {
    paddingTop: PHONE.top + SPACE.s1, paddingBottom: SPACE.s2, paddingLeft: SPACE.s4, paddingRight: SPACE.s4,
    borderBottomWidth: 1, borderBottomStyle: 'solid', display: 'flex', alignItems: 'center', flexShrink: 0,
  }
  const back: CSSProperties = {
    backgroundColor: 'transparent', borderWidth: 0, cursor: 'pointer', appearance: 'none', display: 'flex', alignItems: 'center',
    gap: 2, minHeight: 40, padding: `0 ${SPACE.s3}px`, borderRadius: RADII.control,
  }
  return (
    <div {...painted(paint, 'topBar', bar)}>
      <button type="button" aria-label={APP_COPY.backLabel} {...pressHandlers(press)} {...painted(paint, 'backButton', back, press.pressed ? 'pressed' : 'rest')}>
        <Icon name="chevron-left" size={20} />
        <GoText role="body1" weight={500}>{APP_COPY.back}</GoText>
      </button>
      <span style={{ flex: 1 }} />
      <span role="status" style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2, paddingRight: SPACE.s3 }}>
        <span style={{ width: LIVE_DOT, height: LIVE_DOT, borderRadius: RADII.full, backgroundColor: paint.colours.ccLiveDot }} />
        <GoText role="label" tone="success">{APP_COPY.live}</GoText>
      </span>
    </div>
  )
}

function Head() {
  const { lede, eyebrow } = COMMAND_CENTRE
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2, padding: `${SPACE.s8}px ${SPACE.s8}px ${SPACE.s6}px`, flexShrink: 0 }}>
      <GoText role="eyebrow" tone="muted">{eyebrow}</GoText>
      <GoText role="title1" as="h1">{APP_COPY.commandCentre}</GoText>
      <GoText role="body3" tone="muted" as="p">
        {lede.map((part, index) => (
          <GoText key={index} role={part.figure ? 'figure3' : 'body3'} tone={part.needs ? 'accent' : part.figure ? 'default' : 'muted'}
            style={{ display: 'inline', fontSize: 13, lineHeight: 'inherit', letterSpacing: 0 }}>
            {part.text}
          </GoText>
        ))}
      </GoText>
    </div>
  )
}

function TabStrip() {
  const paint = useGoPaint()
  const strip: CSSProperties = {
    borderBottomWidth: 1, borderBottomStyle: 'solid', display: 'flex', gap: SPACE.s8, padding: `0 ${SPACE.s8}px`, overflowX: 'auto',
    flexShrink: 0,
  }
  return (
    <div role="tablist" aria-label="Command Centre sections" {...painted(paint, 'tabStrip', strip)}>
      {APP_COPY.tabs.map((tab, index) => {
        const part = painted(paint, index === 0 ? 'tabActive' : 'tabRest', {
          display: 'flex', alignItems: 'center', gap: SPACE.s1, minHeight: TAB.height, borderBottomWidth: TAB.rule,
          borderBottomStyle: 'solid', borderBottomColor: 'transparent',
        })
        return (
          <span key={tab.word} role="tab" aria-selected={index === 0} aria-label={`${tab.word}, ${tab.count}`} {...part}>
            <GoText role="body4" weight={TAB.weight} colour={String(part.style.color)}>{tab.word}</GoText>
            <GoText role="label" tone="muted">{tab.count}</GoText>
          </span>
        )
      })}
    </div>
  )
}

function Pill({ pill, selected }: { readonly pill: FilterPill; readonly selected: boolean }) {
  const paint = useGoPaint()
  const press = usePress()
  const layout: CSSProperties = {
    cursor: 'pointer', appearance: 'none', display: 'flex', alignItems: 'center', gap: SPACE.s2, minHeight: PILL.height,
    padding: `0 ${SPACE.s5}px`, borderRadius: RADII.pill, borderWidth: 1, borderStyle: 'solid', flexShrink: 0,
  }
  const part = painted(paint, selected ? 'pillSelected' : 'pillRest', layout, press.pressed && !selected ? 'pressed' : 'rest')
  const ink = String(part.style.color)
  return (
    <button type="button" aria-pressed={selected} aria-label={`${pill.word}, ${pill.count}`} {...pressHandlers(press)} {...part}>
      {pill.status === null ? null : (
        <span style={{ width: PILL.dot, height: PILL.dot, borderRadius: RADII.full, backgroundColor: paint.colours[PIP_COLOURS[pill.status]] }} />
      )}
      <GoText role="body5" weight={PILL.weight} colour={ink}>{pill.word}</GoText>
      <GoText role="label" colour={ink} style={{ opacity: 0.75 }}>{pill.count}</GoText>
    </button>
  )
}

function TicketCard({ ticket }: { readonly ticket: Ticket }) {
  const { colours } = useGoPaint()
  const muted = colours.mutedForeground
  return (
    <Card label={`${ticket.number} ${ticket.title}, ${ticket.word}`} style={{ padding: `${TICKET.paddingY}px ${TICKET.paddingX}px`, gap: TICKET.gap }}>
      <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.s2, color: muted }}>
        <GoText role="label" tone="muted">{ticket.number}</GoText>
        <Icon name={ticket.kind === 'Mission' ? 'target' : 'task'} size={11} />
        <GoText role="label" tone="muted">{ticket.kind}</GoText>
        {ticket.priority === null ? null : <GoText role="label" tone="accent">{`· ${ticket.priority}`}</GoText>}
        <span style={{ flexGrow: 1 }} />
        <StatusPip status={ticket.status} word={ticket.word} />
      </span>
      <GoText role="title5">{ticket.title}</GoText>
      {ticket.reason === null ? null : <Chip label={ticket.reason} />}
      <TicketFoot ticket={ticket} />
    </Card>
  )
}

function TicketFoot({ ticket }: { readonly ticket: Ticket }) {
  const paint = useGoPaint()
  return (
    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.s2 }}>
      {ticket.tags.map((tag) => (
        <span key={tag} {...painted(paint, 'tag', { borderRadius: RADII.tag, padding: `1px ${SPACE.s2}px` })}>
          <GoText role="label" tone="muted" style={{ textTransform: 'none' }}>{tag}</GoText>
        </span>
      ))}
      <span style={{ flexGrow: 1 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: AGENT.gap }}>
        <span style={{ width: AGENT.swatch, height: AGENT.swatch, borderRadius: RADII.tag, backgroundColor: paint.colours[ticket.swatch] }} />
        <GoText role="body6" tone="muted" weight={AGENT.weight}>{ticket.agent}</GoText>
      </span>
    </span>
  )
}

/** The Command Centre on its Board tab. */
export function CommandCentreScreen() {
  const { pills, tickets } = COMMAND_CENTRE
  return (
    <>
      <TopBar />
      <Head />
      <TabStrip />
      <div aria-label="Board" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `${SPACE.s6}px ${SPACE.s8}px ${SPACE.s10 + PHONE.bottom}px`, display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
        <div style={{ display: 'flex', gap: SPACE.s2, marginBottom: SPACE.s5 - SPACE.s3, overflowX: 'auto', flexShrink: 0 }}>
          {pills.map((pill, index) => <Pill key={pill.word} pill={pill} selected={index === 0} />)}
        </div>
        {tickets.map((ticket) => <TicketCard key={ticket.number} ticket={ticket} />)}
      </div>
    </>
  )
}
