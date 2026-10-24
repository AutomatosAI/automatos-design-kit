import styles from './frame.module.css'

/**
 * Behind every page: the look's grid (the accent at grid / 300, 40 px squares) and its glow (the accent at
 * glow / 100, a 640 by 520 radial at 50% 46%, never past the pair's AA cap), on the ground; then the scan
 * lines, one dark pixel in three, shown while the look's scan is on. Both are painted from the look's
 * variables and take no pointer. The scan lines sit under the page, never over it: over the page they would
 * dim its text and lie over the host's approval cards, which nothing may cover.
 */
export function Backdrop() {
  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" data-testid="hud-backdrop" />
      <div className={styles.scan} aria-hidden="true" data-testid="hud-scan" />
    </>
  )
}
