/**
 * Automatos Go's Studio layout on the phone view's screen, painted as the app paints an installed theme: the colours
 * of the scheme on screen (the theme's over Studio's, or Studio's own), the thread's boxes made from them, the theme's
 * fonts as @font-face rules under their own families (a role it doesn't bring keeps Studio's face), and its Auto.
 * The screen's ground is --background (src/ui/Screen.tsx :49); the screen on it is Chat, the Command Centre or First
 * open. `data-go-scheme` names the scheme drawn, so a test or a designer reads what is on screen.
 */
import type { FontRole } from '@automatos/theme-cli/mobile-answer'
import { threadPaint, type PhoneMascot, type StudioColours } from '@automatos/theme-cli/phone'
import { useMemo } from 'react'
import type { PhoneScheme, PhoneScreen } from '../../../src/phone/settings.ts'
import { fontFaceCss } from '../../../src/phone/type.ts'
import { ChatScreen } from './chat.tsx'
import { CommandCentreScreen } from './command-centre.tsx'
import { PLACEHOLDER_CSS } from './composer.tsx'
import { FirstOpenScreen } from './first-open.tsx'
import { GoPaintProvider, painted, type GoPaint } from './paint.tsx'

export interface StudioPhoneProps {
  readonly colours: StudioColours
  /** The scheme `colours` are, for the attribute. */
  readonly scheme: PhoneScheme
  readonly fonts: Readonly<Partial<Record<FontRole, string>>>
  readonly mascot: PhoneMascot | null
  readonly reducedMotion: boolean
  readonly screen: PhoneScreen
}

const SCREENS = Object.freeze({ 'chat': ChatScreen, 'command-centre': CommandCentreScreen, 'first-open': FirstOpenScreen })

/** One screen of the Studio layout, painted. */
export function StudioPhone({ colours, scheme, fonts, mascot, reducedMotion, screen }: StudioPhoneProps) {
  const paint = useMemo<GoPaint>(
    () => ({ colours, thread: threadPaint(colours), fonts, mascot, reducedMotion }),
    [colours, fonts, mascot, reducedMotion],
  )
  const Screen = SCREENS[screen]
  const css = [fontFaceCss(fonts), PLACEHOLDER_CSS].filter((rule) => rule !== '').join('\n')
  const ground = painted(paint, 'screen', {
    flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', fontSynthesis: 'none', WebkitFontSmoothing: 'antialiased',
  })
  return (
    <GoPaintProvider value={paint}>
      <style>{css}</style>
      <div data-go-scheme={scheme} data-go-screen={screen} {...ground}>
        <Screen />
      </div>
    </GoPaintProvider>
  )
}
