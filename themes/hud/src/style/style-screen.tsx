import { HostLink, LOOKS_HREF } from '@automatos/theme-sdk'

import { useHudLooks } from '../looks/use-hud-looks'
import { THEME_HEADING } from '../theme'
import { ColourSection, ContrastSection, KnobSection, StudioSection } from './style-sections'
import { ComponentsSection, TypeSection } from './style-specimens'
import styles from './style.module.css'

/**
 * HUD's /looks/style page (the host's styleSheet@1 slot): what the active look paints, its knobs with the variable
 * each drives, HUD's colours and Studio's tokens with their values, the live contrast, the type and the components.
 * Everything is computed from the active look the SDK's looks area hands over, so the sheet redraws as soon as the
 * look changes anywhere in the app. Until the user's looks have been read it shows its heading alone and is busy.
 */

export const STYLE_TITLE = 'Style sheet'
export const BACK_TO_LOOK = 'Back to the look'

/** The sentence under the heading, naming the active look. */
export const activeLookLine = (name: string): string => `Every value here comes from ${name}, the active look.`

export function StyleScreen() {
  const { look, loaded } = useHudLooks()
  return (
    <div className={styles.screen} aria-busy={loaded ? undefined : true}>
      <header className={styles.header}>
        <div className={styles.headingText}>
          <h1 className={styles.heading} tabIndex={-1} {...THEME_HEADING}>
            {STYLE_TITLE}
          </h1>
          {loaded && <p className={styles.lead}>{activeLookLine(look.name)}</p>}
        </div>
        {loaded && (
          <HostLink href={LOOKS_HREF} className={styles.link}>
            {BACK_TO_LOOK}
          </HostLink>
        )}
      </header>
      {loaded && (
        <div className={styles.sheet}>
          <KnobSection look={look} />
          <div className={styles.columns}>
            <ColourSection look={look} />
            <StudioSection look={look} />
          </div>
          <ContrastSection look={look} />
          <div className={styles.columns}>
            <TypeSection look={look} />
            <ComponentsSection />
          </div>
        </div>
      )}
    </div>
  )
}
