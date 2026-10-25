import { type CSSProperties, type SyntheticEvent, useCallback, useState } from 'react'

import { captionFor } from '@automatos/mascot/media'
import { MascotPauseButton } from '@automatos/mascot/mascot-pause-button'
import { ringTone } from '@automatos/mascot/ring'
import type { MascotName } from '@automatos/mascot/types'

import { useHudLook } from '../lib/looks/use-hud-look'
import { AutoStill, AutoVideo } from './auto-figure'
import styles from './hud-auto.module.css'
import { useAutoMotion, type AutoMotion } from './use-auto-motion'
import { useMascotPlayer } from './use-mascot-player'
import { useVideoFormat } from './use-video-format'

/**
 * Auto in HUD's slot (the Command design's Mascot.dc.html): his clip or still for a state, standing on
 * a ring the page draws, so it can take the look's colour: the accent while he is calm or busy (the design's
 * light and busy are both the accent in HUD), Mascot.dc.html's coral for oops, its dusk while he sleeps or is
 * lost, and its violet while he loads. Shown only while the look's auto knob is on: with it off this draws
 * nothing. The stage is an image named by what he is doing; the chip under him says it in words, a polite live
 * region, so a screen reader hears each change.
 *
 * He moves only where he can be stopped (WCAG 2.2.2): under the OS reduced-motion setting, with the look's
 * motion off, while paused, and until the host knows whether he is paused, he is his still; where his clip can
 * play, the Pause Auto control sits under him, or where the page places it (`pause={false}` and HudPauseControl:
 * the voice core puts it beside its state chip, clear of the rings). The control stands on the page's ground, so
 * nothing drawn behind it shows through. A browser that blocks autoplay, or a clip that won't play, gives stills
 * from then on. The frame's dock places him (src/frame/auto-dock.tsx), and so does the chat's voice core, which
 * drives `state` from @automatos/mascot's reducer.
 */

/** Auto's stage height in px: the frame's dock. The design's voice core is 150 on desktop and 104 on a phone. */
export const AUTO_DOCK_SIZE = 96

export interface HudAutoProps {
  /** The state he shows (the mascot reducer's `mascot`). */
  readonly state: MascotName
  /** A one-shot's clip ended: dispatch {type: 'clip-ended', state} to the reducer. */
  readonly onClipEnded?: (state: MascotName) => void
  /** The stage's height in px. */
  readonly size?: number
  /** Overrides the words for the state (captionFor's). */
  readonly caption?: string
  /** False drops the chip under him, for a page that says the state in its own words. */
  readonly showCaption?: boolean
  /** False keeps him a still where a clip could play. */
  readonly playing?: boolean
  /** True where the page names the state itself: hidden from assistive technology, no live chip. */
  readonly decorative?: boolean
  /** False leaves the Pause Auto control to the page, which places HudPauseControl itself. */
  readonly pause?: boolean
}

type SizeStyle = CSSProperties & { readonly '--hud-auto-size': string }

function pausable(motion: AutoMotion, playing: boolean, decorative: boolean): boolean {
  return playing && !decorative && !motion.reducedMotion && !motion.lookStill
}

/** The clip format to play now, or null for his still; one clip that fails means stills from then on. */
function useClip(motion: AutoMotion, playing: boolean) {
  const format = useVideoFormat()
  const [failed, setFailed] = useState(false)
  const onError = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    console.warn(`[mascot] Auto's clip ${event.currentTarget.src} didn't play, so he is a still.`)
    setFailed(true)
  }, [])
  const onBlocked = useCallback(() => setFailed(true), [])
  const video = !motion.still && playing && !failed ? format : null
  return { video, onError, onBlocked }
}

/** The Pause Auto control: a toggle in HUD's secondary style, disabled until the host knows whether he is paused. */
function AutoPauseButton({ motion }: { readonly motion: AutoMotion }) {
  return (
    <MascotPauseButton
      paused={motion.paused}
      disabled={!motion.ready}
      onToggle={motion.togglePaused}
      className={styles.pause}
      iconClassName={styles.pauseIcon}
    />
  )
}

/** The Pause Auto control where a page places it: drawn only while Auto shows and his clip may play. */
export function HudPauseControl() {
  const auto = useHudLook().auto
  const motion = useAutoMotion()
  if (auto === 'off' || !pausable(motion, true, false)) return null
  return <AutoPauseButton motion={motion} />
}

export function HudAuto(props: HudAutoProps) {
  const auto = useHudLook().auto
  if (auto === 'off') return null
  return <AutoStage {...props} />
}

function AutoStage(props: HudAutoProps) {
  const { state, onClipEnded, size = AUTO_DOCK_SIZE, caption, showCaption = true, playing = true } = props
  const { decorative = false, pause = true } = props
  const motion = useAutoMotion()
  const clip = useClip(motion, playing)
  const player = useMascotPlayer({ target: state, still: clip.video === null, onClipEnded })
  const label = caption ?? captionFor(player.showing)
  const style: SizeStyle = { '--hud-auto-size': `${size}px` }
  return (
    <div
      className={styles.auto}
      style={style}
      data-motion={clip.video === null ? 'still' : undefined}
      aria-hidden={decorative ? true : undefined}
    >
      <div
        className={styles.stage}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        data-ring={ringTone(player.showing)}
      >
        <div className={styles.ring} />
        {clip.video !== null ? (
          <AutoVideo state={player.showing} format={clip.video} player={player} onError={clip.onError} onBlocked={clip.onBlocked} />
        ) : (
          <AutoStill state={player.showing} />
        )}
      </div>
      {showCaption && !decorative && (
        <p className={styles.chip} aria-live="polite" aria-atomic="true">
          {label}
        </p>
      )}
      {pause && pausable(motion, playing, decorative) && <AutoPauseButton motion={motion} />}
    </div>
  )
}
