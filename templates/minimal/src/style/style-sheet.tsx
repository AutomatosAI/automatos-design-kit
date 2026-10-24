import { HostLink, LOOKS_HREF } from '@automatos/theme-sdk'

import { useThemeLooks } from '../looks/use-theme-looks'
import { THEME_HEADING } from '../theme'
import { Colours, Components, TypeScale } from './style-parts'
import { COLOURS, RADIUS_VARIABLE } from './tokens'
import { usePainted } from './use-painted'
import shared from '../looks/looks.module.css'

/**
 * styleSheet@1, the host's /looks/style page under {{name}}: what the active look paints, read from the page itself
 * (its colours, with each variable's value), the type scale and the components. It redraws as soon as the look
 * changes anywhere in the app. Until the user's looks have loaded it shows its heading alone and is busy.
 */

export const STYLE_HEADING = 'Style sheet'
export const BACK_TO_LOOKS = 'Back to the looks'
const PAINTED: readonly string[] = [...COLOURS.map((swatch) => swatch.variable), RADIUS_VARIABLE]

/** The sentence under the heading, naming the active look. */
export const activeLookLine = (name: string): string => `Every value here comes from ${name}, the active look.`

export function StyleSheet() {
  const looks = useThemeLooks()
  const { look } = looks
  const painted = usePainted(PAINTED, `${look.id} ${look.ground} ${look.accent} ${look.corners}`)
  return (
    <div className={shared.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={shared.header}>
        <h1 className={shared.heading} tabIndex={-1} {...THEME_HEADING}>
          {STYLE_HEADING}
        </h1>
        {looks.loaded && <p className={shared.lead}>{activeLookLine(look.name)}</p>}
        {looks.loaded && (
          <HostLink href={LOOKS_HREF} className={shared.link}>
            {BACK_TO_LOOKS}
          </HostLink>
        )}
      </header>
      {looks.loaded && (
        <>
          <Colours painted={painted} />
          <TypeScale />
          <Components radius={painted[RADIUS_VARIABLE] ?? ''} />
        </>
      )}
    </div>
  )
}
