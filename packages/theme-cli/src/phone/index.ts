/**
 * What Automatos Go draws for a theme's `mobile` block, as data: Studio's colours (studio-colours.ts) and an
 * installed theme's painting over them (phone-paint.ts), and the nearest passing colour for a failing contrast pair
 * (nearest-passing.ts). Pure and free of Node's modules, so the harness's phone view (packages/theme-harness/app/phone)
 * and the theme CLI read one copy. `@automatos/theme-cli/phone`.
 */
export {
  alphaHex, isStudioColour, sourceToHex, STUDIO_COLOURS, STUDIO_DARK_SOURCE, STUDIO_LIGHT_SOURCE, tokenName,
  type ColourScheme, type StudioColourName, type StudioColours, type TokenName,
} from './studio-colours.ts'
export {
  overStudio, paintScheme, PHONE_SCHEMES, phonePaint, shownColours, threadPaint, tint, USER_TINT,
  type PhoneMascot, type PhonePaint, type StudioDefaults, type ThreadPaint,
} from './phone-paint.ts'
export { nearestPassing, type FixedPair } from './nearest-passing.ts'
