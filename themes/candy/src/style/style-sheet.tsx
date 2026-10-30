import { HostLink, LOOKS_HREF } from '@automatos/theme-sdk'

import { useThemeLooks } from '../looks/use-theme-looks'
import type { ThemeLook } from '../looks/spec'
import { THEME_HEADING } from '../theme'
import { Colours, PAINTED_VARIABLES } from './style-colours'
import { AutoStates, CardGradients, Controls, TypeScale } from './style-parts'
import { usePainted } from './use-painted'
import styles from './style.module.css'
import ui from '../ui/ui.module.css'

/**
 * styleSheet@1, the host's /looks/style page under Candy: what the active look paints, read from the page itself.
 * The type scale, the palette's colours with each design pair's contrast measured as painted now, the three card
 * gradients under Soft, Rich and Vivid, the buttons, pills and chips, and Auto in his twelve states. It redraws as
 * soon as the look changes anywhere in the app. Until the user's looks have loaded it shows its heading alone and is
 * busy.
 */

export const STYLE_HEADING = 'Style sheet'
export const BACK_TO_LOOK = 'Your look'

/** The sentence under the heading, naming the active look. */
export const activeLookLine = (name: string): string => `Every value here comes from ${name}, the active look.`

/** The knobs that change a painted colour: the page reads its colours again when one of them does. */
const colourKey = (look: ThemeLook): string => [look.id, look.palette, look.cards, look.gradient, look.glow].join(' ')

export function StyleSheet() {
  const looks = useThemeLooks()
  const { look } = looks
  const painted = usePainted(PAINTED_VARIABLES, colourKey(look))
  return (
    <div className={styles.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={ui.pageHead}>
        <h1 className={`${ui.pageTitle} ${styles.heading}`} tabIndex={-1} {...THEME_HEADING}>
          {STYLE_HEADING}
        </h1>
        {looks.loaded && (
          <HostLink href={LOOKS_HREF} className={`${ui.secondary} ${ui.small}`}>
            {BACK_TO_LOOK}
          </HostLink>
        )}
      </header>
      {looks.loaded && (
        <>
          <p className={styles.lead}>{activeLookLine(look.name)}</p>
          <TypeScale />
          <Colours painted={painted} name={look.name} />
          <CardGradients />
          <Controls />
          <AutoStates />
        </>
      )}
    </div>
  )
}
