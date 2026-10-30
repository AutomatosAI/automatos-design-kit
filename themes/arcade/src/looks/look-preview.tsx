import { AutoSprite } from '../art/pixel-art'
import { paletteById } from './catalogue'
import { speedOf, useTypewriter } from '../chat/typewriter'
import { useMotion } from '../motion/use-motion'
import type { ThemeLook } from './spec'
import styles from './looks.module.css'
import ui from '../ui/ui.module.css'

/**
 * The Options screen's PREVIEW window: Auto celebrating beside a line that types at the chosen speed, the four game
 * colours as labels, a selected and a plain menu item, and accent text on the page ground. It is drawn in the active
 * look itself, so every change shows here and everywhere at once.
 */

export const PREVIEW = 'Preview'
export const PREVIEW_LINE = 'Text types out at this speed. Press on, hero.'
export const GAME_COLOURS: readonly { readonly word: string; readonly tone: 'hp' | 'xp' | 'mp' | 'qs' }[] = [
  { word: 'HP', tone: 'hp' },
  { word: 'XP', tone: 'xp' },
  { word: 'Mana', tone: 'mp' },
  { word: '! Quest', tone: 'qs' },
]
export const SELECTED_ITEM = 'Selected menu item'
export const MENU_ITEM = 'Menu item'
export const ACCENT_LINE = 'Accent text on the page ground reads here.'

export function LookPreview({ look }: { readonly look: ThemeLook }) {
  const { moving } = useMotion()
  const speed = speedOf(look.textSpeed)
  const typing = useTypewriter(`preview-${speed}`, PREVIEW_LINE, { speed, moving, streaming: false, whole: false })
  const name = paletteById(look.palette)?.name ?? look.name
  return (
    <section className={`${ui.window} ${styles.preview}`} aria-label={PREVIEW}>
      <h2 className={ui.label}>{`${PREVIEW} · ${name}`}</h2>
      <div className={styles.previewSay}>
        <AutoSprite state="celebrate" view="small" />
        <p className={styles.previewLine}>
          <span aria-hidden="true">{PREVIEW_LINE.slice(0, typing.shown)}</span>
          <span className={ui.hidden}>{PREVIEW_LINE}</span>
        </p>
      </div>
      <ul className={styles.gameColours}>
        {GAME_COLOURS.map((colour) => (
          <li key={colour.tone} className={styles.gameColour} data-tone={colour.tone}>
            {colour.word}
          </li>
        ))}
      </ul>
      <div className={styles.sampleMenu} aria-hidden="true">
        <span className={styles.sampleItem} data-selected="true">
          <span className={styles.sampleCursor}>▶</span>
          {SELECTED_ITEM}
        </span>
        <span className={styles.sampleItem}>
          <span className={styles.sampleCursor} />
          {MENU_ITEM}
        </span>
      </div>
      <p className={styles.accentLine}>{ACCENT_LINE}</p>
    </section>
  )
}
