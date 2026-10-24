'use client'

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
 *
 * PRD-261 B-01i: in @automatos/mascot the control brings no stylesheet; the theme
 * gives the button's and the two-bar icon's classes (Play's auto-mascot.module.css
 * .pause and .pauseIcon).
 */

export const PAUSE_AUTO = 'Pause Auto'

export interface MascotPauseButtonProps {
  readonly paused: boolean
  readonly onToggle: () => void
  /** True while the host can't say yet whether Auto is paused (useMascotMotion's `ready` is false). */
  readonly disabled?: boolean
  /** The theme's class for the button. */
  readonly className?: string
  /** The theme's class for the icon inside it (two bars, drawn by the theme's CSS). */
  readonly iconClassName?: string
}

export function MascotPauseButton({ paused, onToggle, disabled = false, className, iconClassName }: MascotPauseButtonProps) {
  return (
    <button type="button" className={className} aria-pressed={paused} disabled={disabled} onClick={onToggle}>
      <span className={iconClassName} aria-hidden="true" />
      {PAUSE_AUTO}
    </button>
  )
}
