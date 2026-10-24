/**
 * The phone the view draws in: a 390 × 844 screen (an iPhone's points, a point a CSS pixel) in a dark bezel, the
 * status bar's 47 pt and the home indicator's 34 pt the safe area the app's screens keep clear (they paint their own
 * ground under both, as the app's header and composer do). The status bar's ink follows the screen's tone, as
 * expo-status-bar does for the app (src/styles/ground/ground.ts statusBarStyle).
 */
import type { CSSProperties, ReactNode } from 'react'

export const PHONE = Object.freeze({ width: 390, height: 844, top: 47, bottom: 34 })
const BEZEL = 12
const SCREEN_RADIUS = 44
const BEZEL_COLOUR = '#0c0c0e'
const STATUS_INK = Object.freeze({ light: '#000000', dark: '#ffffff' })
const HOME_BAR = Object.freeze({ width: 134, height: 5 })

const SCREEN_STYLE: CSSProperties = Object.freeze({
  position: 'relative',
  width: PHONE.width,
  height: PHONE.height,
  overflow: 'hidden',
  borderRadius: SCREEN_RADIUS,
  display: 'flex',
  flexDirection: 'column',
})

export interface PhoneFrameProps {
  /** The tone the screen is drawn in: the status bar's ink. */
  readonly tone: 'light' | 'dark'
  readonly label: string
  /** False leaves the status bar and the home indicator out (a web theme drawn at the phone's width). */
  readonly bars?: boolean
  readonly children: ReactNode
}

function StatusBar({ tone }: { readonly tone: 'light' | 'dark' }) {
  const style: CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, height: PHONE.top, zIndex: 2, pointerEvents: 'none',
    display: 'flex', alignItems: 'center', padding: '0 32px', boxSizing: 'border-box',
    font: '600 16px system-ui, sans-serif', color: STATUS_INK[tone],
  }
  return <div aria-hidden="true" data-phone-status-bar={tone} style={style}>9:41</div>
}

function HomeBar({ tone }: { readonly tone: 'light' | 'dark' }) {
  const style: CSSProperties = {
    position: 'absolute', bottom: 8, left: (PHONE.width - HOME_BAR.width) / 2, width: HOME_BAR.width, height: HOME_BAR.height,
    borderRadius: HOME_BAR.height, background: STATUS_INK[tone], zIndex: 2, pointerEvents: 'none',
  }
  return <div aria-hidden="true" style={style} />
}

/** The device: the bezel, the screen and its two system bars over the app's own screen. */
export function PhoneFrame({ tone, label, bars = true, children }: PhoneFrameProps) {
  return (
    <div role="group" aria-label={label} data-phone-frame="" style={{ padding: BEZEL, borderRadius: SCREEN_RADIUS + BEZEL, background: BEZEL_COLOUR, flexShrink: 0 }}>
      <div data-phone-screen="" style={SCREEN_STYLE}>
        {bars ? <StatusBar tone={tone} /> : null}
        {children}
        {bars ? <HomeBar tone={tone} /> : null}
      </div>
    </div>
  )
}
