import { HostLink, LOOKS_HREF } from '@automatos/theme-sdk'

import { AutoSprite } from '../art/pixel-art'
import { SPRITE_STATES } from '../art/states'
import { paletteById } from '../looks/catalogue'
import { contrastRatio, rgbOfCss } from '../looks/colour'
import { AA_TEXT, DESIGN_PAIRS, type LabelledPair } from '../looks/pairs'
import { useThemeLooks } from '../looks/use-theme-looks'
import { THEME_HEADING } from '../theme'
import { usePainted } from './use-painted'
import shared from '../looks/looks.module.css'
import styles from './style.module.css'
import ui from '../ui/ui.module.css'

/**
 * styleSheet@1, the host's /looks/style page under Arcade: the design's Sprite gallery. Auto's twelve states, each
 * moving (while motion is on) and as its still, with its frame count and what it shows; the design's colour pairs in
 * the active look, each measured from the colours the page is painted in now; and the two faces. The sprites here are
 * decoration: each state's name is its words.
 */

export const STYLE_HEADING = 'Sprite gallery'
export const BACK_TO_OPTIONS = 'Back to the options'
export const GALLERY = 'Sprite gallery · Auto'
export const GALLERY_NOTE = '32 × 32 pixels, stepped frames'
export const PAIRS = 'Pairs'
export const TYPE = 'Type'
const NOT_PAINTED = '–'
const PAINTED_VARIABLES: readonly string[] = [...new Set(DESIGN_PAIRS.flatMap((pair) => [pair.text, pair.ground]))]

function Gallery() {
  return (
    <section className={`${ui.window} ${styles.section}`} aria-label={GALLERY}>
      <div className={styles.sectionHead}>
        <h2 className={ui.label}>{GALLERY}</h2>
        <span className={ui.aside}>{GALLERY_NOTE}</span>
      </div>
      <ul className={styles.gallery}>
        {SPRITE_STATES.map((state) => (
          <li key={state.name} className={styles.tile}>
            <AutoSprite state={state.name} view="small" />
            <span className={styles.tileName}>
              <AutoSprite state={state.name} view="still" still />
              <span className={ui.label}>{state.name}</span>
            </span>
            <span className={styles.tileNote}>{`${state.frames.length} frames · ${state.note}`}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ratioOf(pair: LabelledPair, painted: Readonly<Record<string, string>>): number | null {
  const text = rgbOfCss(painted[pair.text] ?? '')
  const ground = rgbOfCss(painted[pair.ground] ?? '')
  return text && ground ? contrastRatio(text, ground) : null
}

function Pairs({ painted, name }: { readonly painted: Readonly<Record<string, string>>; readonly name: string }) {
  return (
    <section className={`${ui.window} ${styles.section}`} aria-label={PAIRS}>
      <h2 className={ui.label}>{`${PAIRS} · ${name}`}</h2>
      <ul className={styles.pairs}>
        {DESIGN_PAIRS.map((pair) => {
          const ratio = ratioOf(pair, painted)
          const pass = ratio !== null && ratio >= (pair.min ?? AA_TEXT)
          return (
            <li key={pair.label} className={styles.pair}>
              <span className={styles.swatch} style={{ color: `var(${pair.text})`, background: `var(${pair.ground})` }} aria-hidden="true">
                Aa
              </span>
              <span>{pair.label}</span>
              <span className={styles.ratio}>{ratio === null ? NOT_PAINTED : ratio.toFixed(2)}</span>
              {ratio !== null && (
                <span className={ui.status} data-tone={pass ? 'active' : 'failed'}>
                  {pass ? '✓ PASS' : '✕ FAIL'}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TypeSpecimen() {
  return (
    <section className={`${ui.window} ${styles.section} ${styles.type}`} aria-label={TYPE}>
      <h2 className={ui.label}>{TYPE}</h2>
      <p className={styles.display}>Quest log</p>
      <p className={ui.note}>Blocky display face · headings and labels only · 8, 10, 12, 16 px</p>
      <p className={styles.body}>Your shortlist is in your bag. Running text uses the taller face, 15 to 25 px.</p>
      <p className={ui.note}>Readable pixel face · running text · both SIL Open Font License, shipped in the package</p>
    </section>
  )
}

export function StyleSheet() {
  const looks = useThemeLooks()
  const { look } = looks
  const painted = usePainted(PAINTED_VARIABLES, `${look.id} ${look.palette}`)
  const name = paletteById(look.palette)?.name ?? look.name
  return (
    <div className={shared.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={shared.header}>
        <h1 className={ui.title} tabIndex={-1} {...THEME_HEADING}>
          {STYLE_HEADING}
        </h1>
        {looks.loaded && (
          <HostLink href={LOOKS_HREF} className={shared.link}>
            {BACK_TO_OPTIONS}
          </HostLink>
        )}
      </header>
      {looks.loaded && (
        <>
          <Gallery />
          <div className={styles.columns}>
            <Pairs painted={painted} name={name} />
            <TypeSpecimen />
          </div>
        </>
      )}
    </div>
  )
}
