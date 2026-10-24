/**
 * The chat thread as the app draws it (src/chat/components at the Automatos Go commit packages/theme-cli's README
 * names): the AI label first (src/styles/ai-label.tsx :18-:30, Body 6 muted); the user's words in a box on the right,
 * primary at 10 % over the page with its 1 pt edge, kept 48 pt from the left (UserBubble.tsx, thread-look.ts
 * :186-:237); Auto's message beside its sail on the accent disc (AutoAvatar.tsx, AutoColumn.tsx): its box a Studio
 * card holding the answer, the tool lines (ToolLines.tsx :16-:57: a mark in its tone's colour, then the words), a rule
 * and 'What Auto did' (ReceiptsCard.tsx :66-:83); and below the box, never inside it, the Deliverable the turn made
 * (src/cc/deliverables/DeliverableCard.tsx :71-:108). 24 pt between turns, 8 pt within Auto's run.
 */
import type { CSSProperties } from 'react'
import { MARK_COLOURS } from '../../../src/phone/parts.ts'
import { APP_COPY, EXCHANGE, type ToolLine } from './copy.ts'
import { painted, useGoPaint } from './paint.tsx'
import { Card, Divider, HAIRLINE_SHADOW, Icon, RADII, SailMark, SPACE } from './primitives.tsx'
import { GoText } from './text.tsx'

/** thread-look.ts THREAD (:31-:49). */
const THREAD = Object.freeze({ avatar: 28, sail: 15, userInset: 48, border: 1 })
const MARK_WIDTH = 12

function UserBubble() {
  const paint = useGoPaint()
  const layout: CSSProperties = {
    alignSelf: 'flex-end', marginLeft: THREAD.userInset, padding: `${SPACE.s4}px ${SPACE.s6}px`, borderWidth: THREAD.border,
    borderStyle: 'solid', borderRadius: RADII.panel, display: 'flex', flexDirection: 'column', gap: SPACE.s1,
  }
  return (
    <div aria-label={`You said: ${EXCHANGE.asked}`} {...painted(paint, 'userBubble', layout)}>
      <GoText role="thread">{EXCHANGE.asked}</GoText>
    </div>
  )
}

function AutoAvatar() {
  const paint = useGoPaint()
  const layout: CSSProperties = {
    width: THREAD.avatar, height: THREAD.avatar, borderRadius: RADII.full, flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  }
  return (
    <div role="heading" aria-level={3} aria-label={APP_COPY.autoSaid} {...painted(paint, 'autoAvatar', layout)}>
      <SailMark height={THREAD.sail} colour={paint.thread.sail} />
    </div>
  )
}

function MarkedLine({ line, role }: { readonly line: ToolLine; readonly role: 'body6' | 'body4' }) {
  const { colours } = useGoPaint()
  return (
    <div data-go-mark={line.tone} style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.s3 }}>
      <GoText role="label" colour={colours[MARK_COLOURS[line.tone]]} style={{ width: MARK_WIDTH, flexShrink: 0 }}>{line.mark}</GoText>
      <GoText role={role} style={{ flex: 1, minWidth: 0 }}>{line.text}</GoText>
    </div>
  )
}

function Receipts() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
      <GoText role="label" tone="muted" as="h3">{APP_COPY.receiptsTitle}</GoText>
      {EXCHANGE.receipts.map((line) => <MarkedLine key={line.text} line={line} role="body4" />)}
      <GoText role="body6" tone="muted">{EXCHANGE.receiptsNote}</GoText>
    </div>
  )
}

function AutoBox() {
  const paint = useGoPaint()
  const layout: CSSProperties = {
    alignSelf: 'stretch', padding: `${SPACE.s5}px ${SPACE.s6}px`, borderWidth: THREAD.border, borderStyle: 'solid',
    borderRadius: RADII.panel, boxShadow: HAIRLINE_SHADOW, display: 'flex', flexDirection: 'column', gap: SPACE.s5,
  }
  return (
    <div {...painted(paint, 'autoBox', layout)}>
      <GoText role="thread" as="p">{EXCHANGE.answer}</GoText>
      <div aria-label="Tool calls" style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s1 }}>
        {EXCHANGE.tools.map((line) => <MarkedLine key={line.text} line={line} role="body6" />)}
      </div>
      <Divider />
      <Receipts />
    </div>
  )
}

/** DeliverableCard.tsx: the type row, the serif title, the excerpt and who made it when. */
function DeliverableCard() {
  const { deliverable } = EXCHANGE
  const { colours } = useGoPaint()
  return (
    <Card label={`${deliverable.type}: ${deliverable.title}`} radius="panel" style={{ padding: `13px ${SPACE.s6}px`, gap: SPACE.s3 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: colours.mutedForeground }}>
        <Icon name="report" size={14} />
        <GoText role="label" tone="muted">{deliverable.type}</GoText>
      </span>
      <GoText role="title4">{deliverable.title}</GoText>
      <GoText role="body4" tone="muted" lines={3}>{deliverable.excerpt}</GoText>
      <GoText role="label" tone="muted" style={{ textTransform: 'none' }}>{deliverable.meta}</GoText>
    </Card>
  )
}

function AutoMessage() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE.s3 }}>
      <AutoAvatar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
        <AutoBox />
        <DeliverableCard />
      </div>
    </div>
  )
}

/** The thread, scrolling under the header and over the composer. */
export function Thread() {
  return (
    <div role="log" aria-label="Chat with Auto" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: SPACE.s7, display: 'flex', flexDirection: 'column' }}>
      <GoText role="body6" tone="muted" style={{ paddingBottom: SPACE.s7 }}>{APP_COPY.aiLabel}</GoText>
      <UserBubble />
      <div style={{ paddingTop: SPACE.s9 }}>
        <AutoMessage />
      </div>
    </div>
  )
}
