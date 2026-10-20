'use client'

import styles from './auto-mascot.module.css'

/**
 * PRD-261 A-13b (F10, WCAG 2.2.2) — the Pause Auto control under Auto. A toggle
 * button with one name and aria-pressed (as the style sheet's "Play Auto's
 * states"), so a screen reader hears "Pause Auto, pressed" while he is paused
 * rather than a name that flips under the user. AutoMascot shows it wherever he
 * can move; under the OS reduced-motion setting nothing moves, so there is none.
 *
 * PRD-261 E3g: until the host can say whether he is paused, a press could change
 * nothing, so the control is a native disabled button: announced as unavailable,
 * still not pressed, and out of the tab order until the flag is known.
 */

export const PAUSE_AUTO = 'Pause Auto'

export interface MascotPauseButtonProps {
  readonly paused: boolean
  readonly onToggle: () => void
  /** True while the host can't say yet whether Auto is paused (useMascotMotion's `ready` is false). */
  readonly disabled?: boolean
}

export function MascotPauseButton({ paused, onToggle, disabled = false }: MascotPauseButtonProps) {
  return (
    <button type="button" className={styles.pause} aria-pressed={paused} disabled={disabled} onClick={onToggle}>
      <span className={styles.pauseIcon} aria-hidden="true" />
      {PAUSE_AUTO}
    </button>
  )
}
