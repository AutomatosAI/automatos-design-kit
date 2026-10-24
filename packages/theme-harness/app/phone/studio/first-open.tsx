/**
 * First open, the home before the first message (the app's src/styles/edges/FirstOpen.tsx :93-:157 on the Studio
 * layout, at the Automatos Go commit packages/theme-cli's README names): the sail mark, Auto at hello, 170 pt, on the
 * right (only when an installed theme brings him: Studio itself shows none), 'Talk to Auto' in Newsreader 28, the lede
 * at 15/1.5 in the muted ink (edges/paint.ts :56-:69), and the home's composer under them.
 *
 * Auto is the theme's own file for the state (src/phone/mascot.ts): the clip under `clips` while motion is allowed,
 * the still under `stills` or Reduce Motion; nothing under `none` or for a theme that brings no Auto. A state the
 * theme has no still for keeps the app's own Auto, which the harness does not carry: a labelled stand-in says so.
 */
import type { CSSProperties } from 'react'
import { mascotShown } from '../../../src/phone/mascot.ts'
import { PHONE } from '../frame.tsx'
import { Composer } from './composer.tsx'
import { APP_COPY } from './copy.ts'
import { useGoPaint } from './paint.tsx'
import { SailMark } from './primitives.tsx'
import { GoText } from './text.tsx'

/** geometry.ts MASCOT_SIZES.firstOpen; his stage is 0.9 s × s (Mascot.tsx :88). */
export const MASCOT_SIZE = 170
const STAGE = Object.freeze({ width: MASCOT_SIZE * 0.9, height: MASCOT_SIZE })
const HELLO = 'hello'
/** edges/metrics.ts EDGE_METRICS: the sides, the column's gap, the lede and the sail mark. */
const EDGE = Object.freeze({ padX: 24, gap: 16, ledeSize: 15, ledeLeading: 1.5, brandMark: 40, composer: { top: 6, x: 12, bottom: 6 } })

function Auto() {
  const { mascot, reducedMotion } = useGoPaint()
  const shown = mascotShown(mascot, HELLO, reducedMotion)
  const stage: CSSProperties = { width: STAGE.width, height: STAGE.height, alignSelf: 'flex-end', flexShrink: 0 }
  const media: CSSProperties = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' }
  if (shown.kind === 'none') return null
  if (shown.kind === 'bundled') {
    return <div data-go-mascot="bundled" role="img" aria-label={`${APP_COPY.autoHello} (the app's own Auto)`} style={{ ...stage, border: '1px dashed currentColor' }} />
  }
  return (
    <div data-go-mascot={shown.kind} role="img" aria-label={APP_COPY.autoHello} style={stage}>
      {shown.kind === 'clip'
        ? <video src={shown.clip} poster={shown.still} autoPlay loop muted playsInline aria-hidden="true" style={media} />
        : <img src={shown.still} alt="" style={media} />}
    </div>
  )
}

/** First open on the Studio layout. */
export function FirstOpenScreen() {
  const { colours } = useGoPaint()
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: EDGE.gap, padding: `${PHONE.top}px ${EDGE.padX}px 0`, color: colours.mutedForeground }}>
        <SailMark height={EDGE.brandMark} colour={colours.foreground} />
        <Auto />
        <GoText role="title1" as="h1">{APP_COPY.firstOpenTitle}</GoText>
        <GoText role="body1" tone="muted" as="p" style={{ fontSize: EDGE.ledeSize, lineHeight: `${EDGE.ledeSize * EDGE.ledeLeading}px` }}>
          {APP_COPY.firstOpenLede}
        </GoText>
      </div>
      <div style={{ padding: `${EDGE.composer.top}px ${EDGE.composer.x}px ${EDGE.composer.bottom + PHONE.bottom}px`, flexShrink: 0 }}>
        <Composer />
      </div>
    </>
  )
}
