/**
 * Studio's type scale as Automatos Go sets it, for the phone view's Studio layout: the app's src/styles/type.ts
 * (LEADING :29, TRACKING :32-:38, TYPE_SPECS :117-:138, at the Automatos Go commit packages/theme-cli's README names),
 * one point a CSS pixel on the 390-wide phone. The three families are the page's own copies of the app's faces
 * (app/index.html declares core's Newsreader, Geist and Geist Mono). An installed theme's font for a role takes that
 * family at every weight, sizes and spacing staying Studio's (src/styles/themes/type.ts :51-:56); a role whose file
 * does not load keeps Studio's face, here as the next family in the stack. No DOM: app/phone/studio/text.tsx draws it.
 */
import type { FontRole } from '@automatos/theme-cli/mobile-answer'

export type TypeFamily = FontRole
export type TypeRole =
  | 'title1' | 'title2' | 'title3' | 'title4' | 'title5' | 'title6'
  | 'body1' | 'body2' | 'body3' | 'body4' | 'body5' | 'body6'
  | 'thread' | 'threadTitle1' | 'threadTitle2' | 'eyebrow' | 'label' | 'figure1' | 'figure2' | 'figure3'

export interface TypeSpec {
  readonly family: TypeFamily
  readonly weight: number
  readonly size: number
  readonly leading: number
  /** em */
  readonly tracking: number
  readonly uppercase?: boolean
  readonly tabular?: boolean
}

/** D38: the smallest text on the phone, in points. */
export const MIN_TEXT_SIZE = 11
export const LEADING = Object.freeze({ display: 1.05, heading: 1.15, body: 1.5, lede: 1.55 })
export const TRACKING = Object.freeze({ display: -0.02, heading: -0.015, eyebrow: 0.1, label: 0.12, figure: -0.02 })

const TITLE_WEIGHT = 500
const BODY_WEIGHT = 400
const MONO_WEIGHT = 600

const title = (size: number, leading: number = LEADING.heading, tracking: number = TRACKING.heading): TypeSpec => (
  { family: 'serif', weight: TITLE_WEIGHT, size, leading, tracking }
)
const body = (size: number, leading: number = LEADING.body): TypeSpec => (
  { family: 'sans', weight: BODY_WEIGHT, size, leading, tracking: 0 }
)
const mono = (tracking: number): TypeSpec => (
  { family: 'mono', weight: MONO_WEIGHT, size: MIN_TEXT_SIZE, leading: LEADING.heading, tracking, uppercase: true }
)
const figure = (size: number): TypeSpec => (
  { family: 'mono', weight: MONO_WEIGHT, size, leading: LEADING.heading, tracking: TRACKING.figure, tabular: true }
)

/** The handoff's sizes by role, as the app's TYPE_SPECS gives them. */
export const TYPE_SPECS: Readonly<Record<TypeRole, TypeSpec>> = Object.freeze({
  title1: title(28, LEADING.display, TRACKING.display),
  title2: title(23),
  title3: title(21),
  title4: title(15),
  title5: title(14.5),
  title6: title(14),
  body1: body(14, LEADING.lede),
  body2: body(13.5),
  body3: body(13),
  body4: body(12.5),
  body5: body(12),
  body6: body(11.5),
  thread: body(16, LEADING.body),
  threadTitle1: title(19),
  threadTitle2: title(17),
  eyebrow: mono(TRACKING.eyebrow),
  label: mono(TRACKING.label),
  figure1: figure(19),
  figure2: figure(17),
  figure3: figure(15),
})

/** The page's faces for Studio's three families (app/index.html's @font-face rules). */
export const STUDIO_FACES: Readonly<Record<TypeFamily, string>> = Object.freeze({
  serif: 'harness-newsreader',
  sans: 'harness-geist-sans',
  mono: 'harness-geist-mono',
})
const GENERIC: Readonly<Record<TypeFamily, string>> = Object.freeze({ serif: 'serif', sans: 'sans-serif', mono: 'monospace' })
const THEME_FAMILY_PREFIX = 'go-theme-'

/** The family a theme's font for a role is declared under on the page (the app's 'theme-<installId>-<role>'). */
export function themeFamily(role: TypeFamily): string {
  return `${THEME_FAMILY_PREFIX}${role}`
}

/** The CSS font-family for a family: the theme's own face first when it brings one, then Studio's. */
export function familyStack(family: TypeFamily, themed: Readonly<Partial<Record<TypeFamily, string>>>): string {
  const faces = [...(themed[family] === undefined ? [] : [themeFamily(family)]), STUDIO_FACES[family]]
  return [...faces.map((face) => `'${face}'`), GENERIC[family]].join(', ')
}

/** A role's text as the page sets it: CSS values, a point a pixel. */
export interface TypeStyle {
  readonly fontFamily: string
  readonly fontSize: number
  readonly lineHeight: string
  readonly letterSpacing: string
  readonly fontWeight: number
  readonly textTransform?: 'uppercase'
  readonly fontVariantNumeric?: 'tabular-nums'
}

const DECIMALS = 100
const rounded = (value: number): number => Math.round(value * DECIMALS) / DECIMALS

/** The app's toTypeStyle (:146-:163) as CSS, at another weight when given. */
export function typeStyle(role: TypeRole, themed: Readonly<Partial<Record<TypeFamily, string>>>, weight?: number): TypeStyle {
  const spec = TYPE_SPECS[role]
  return {
    fontFamily: familyStack(spec.family, themed),
    fontSize: spec.size,
    lineHeight: `${rounded(spec.size * spec.leading)}px`,
    letterSpacing: `${rounded(spec.size * spec.tracking)}px`,
    fontWeight: weight ?? spec.weight,
    ...(spec.uppercase ? { textTransform: 'uppercase' as const } : {}),
    ...(spec.tabular ? { fontVariantNumeric: 'tabular-nums' as const } : {}),
  }
}

/** The @font-face rules for a painting's fonts: each role at its URL, under themeFamily(role). */
export function fontFaceCss(fonts: Readonly<Partial<Record<TypeFamily, string>>>): string {
  const roles = Object.keys(GENERIC) as TypeFamily[]
  return roles
    .flatMap((role) => {
      const url = fonts[role]
      return url === undefined ? [] : [`@font-face { font-family: '${themeFamily(role)}'; src: url(${JSON.stringify(url)}); font-display: swap; }`]
    })
    .join('\n')
}
