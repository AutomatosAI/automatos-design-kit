import { useMotion } from './use-motion'
import ui from '../ui/ui.module.css'

/**
 * The control that stops Arcade's motion (WCAG 2.2.2: anything that moves, blinks or loops for more than five seconds
 * can be paused): Auto's sprites hold their first frame, the cursors stop blinking and the dialogue box shows each
 * line whole. A toggle with one name and aria-pressed, kept per account. Under the OS's reduced motion nothing moves,
 * so there is none; until the host can say what was chosen it is a disabled button.
 */

export const PAUSE_LABEL = 'Pause animation'

export function PauseToggle({ className }: { readonly className?: string }) {
  const { reduced, paused, ready, togglePause } = useMotion()
  if (reduced) return null
  return (
    <button
      type="button"
      className={className ?? ui.secondary}
      aria-pressed={paused}
      disabled={!ready}
      onClick={togglePause}
    >
      <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
      {PAUSE_LABEL}
    </button>
  )
}
