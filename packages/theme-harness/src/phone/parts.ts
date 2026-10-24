/**
 * Where Automatos Go's Studio layout puts each colour, part by part, for the phone view's three screens (Chat, the
 * Command Centre and First open): one table the view paints from (app/phone/studio/), its tests check, and a designer
 * can read to light up where a token lands. Each part names the CSS colour properties it paints, the Studio colour
 * (or the thread's box, or a colour at an alpha) each reads, the paints it takes while pressed or focused, and the
 * app's file and lines it follows, at the Automatos Go commit packages/theme-cli's README names. Text takes a tone
 * (TEXT_TONES), a status dot its status's colour (PIP_COLOURS), a tool line's mark its tone's (MARK_COLOURS).
 */
import { tint, type StudioColourName, type StudioColours, type ThreadPaint } from '@automatos/theme-cli/phone'

export type PaintSlot = 'backgroundColor' | 'borderColor' | 'borderTopColor' | 'borderBottomColor' | 'color'
/** One of the thread's boxes (tokens/thread.ts), resolved from the page's colours. */
export interface ThreadRef { readonly thread: keyof ThreadPaint }
/** A colour at an alpha (src/ui/paint.ts tint): a chip's ground. */
export interface TintRef { readonly tint: StudioColourName; readonly alpha: number }
export type PaintRef = StudioColourName | ThreadRef | TintRef
export type Paints = Readonly<Partial<Record<PaintSlot, PaintRef>>>
export type PartState = 'rest' | 'pressed' | 'focused'

export interface PartSpec {
  readonly paints: Paints
  /** Over the rest's while pressed (src/ui/variants.ts: the handoff's hover) or focused (fieldPaint's ring). */
  readonly pressed?: Paints
  readonly focused?: Paints
  readonly app: string
}

/** variants.ts TONES.accent: the reason chip is the accent at 10 %. */
const CHIP_ALPHA = 0.1
const CARD_PRESSED: Paints = { backgroundColor: 'ccHover', borderColor: 'ccHoverBorder' }
const GHOST_PRESSED: Paints = { backgroundColor: 'ccHover', color: 'foreground' }

export const STUDIO_PARTS = {
  screen: { paints: { backgroundColor: 'background' }, app: 'src/ui/Screen.tsx:49' },
  headerBar: { paints: { backgroundColor: 'secondary', borderBottomColor: 'border' }, app: 'src/chat/home/HeaderBar.tsx:26-31' },
  menuButton: { paints: { color: 'foreground' }, pressed: GHOST_PRESSED, app: 'src/chat/home/MenuButton.tsx:35-48' },
  countBadge: { paints: { backgroundColor: 'accent', color: 'accentForeground' }, app: 'src/ui/CountBadge.tsx:23-37' },
  needsStrip: { paints: { borderBottomColor: 'border' }, app: 'src/chat/home/NeedsStrip.tsx:65-69' },
  ghostButton: { paints: { color: 'mutedForeground' }, pressed: GHOST_PRESSED, app: 'src/ui/variants.ts:126-130' },
  card: { paints: { backgroundColor: 'card', borderColor: 'border' }, pressed: CARD_PRESSED, app: 'src/ui/variants.ts:185-192' },
  userBubble: {
    paints: { backgroundColor: { thread: 'userFill' }, borderColor: { thread: 'userBorder' }, color: 'foreground' },
    app: 'src/chat/components/thread-look.ts:219-237',
  },
  autoAvatar: { paints: { backgroundColor: { thread: 'avatar' }, color: { thread: 'sail' } }, app: 'src/chat/components/AutoAvatar.tsx:27-44' },
  autoBox: {
    paints: { backgroundColor: { thread: 'autoFill' }, borderColor: { thread: 'autoBorder' } },
    app: 'src/chat/components/thread-look.ts:219-237',
  },
  divider: { paints: { backgroundColor: 'border' }, app: 'src/ui/Divider.tsx:20-28' },
  composer: { paints: { backgroundColor: 'card', borderTopColor: 'border' }, app: 'src/chat/composer/Composer.tsx:91-101' },
  composerInset: { paints: { backgroundColor: 'card' }, app: 'src/chat/screens/ChatFrame.tsx:33' },
  pillInput: {
    paints: { backgroundColor: 'background', borderColor: 'border', color: 'foreground' },
    focused: { borderColor: 'ring' },
    app: 'src/chat/composer/PillInput.tsx:43-62',
  },
  sendButton: {
    paints: { backgroundColor: 'primary', borderColor: 'primary', color: 'primaryForeground' },
    app: 'src/ui/variants.ts:103-107',
  },
  topBar: { paints: { backgroundColor: 'secondary', borderBottomColor: 'border' }, app: 'src/cc/shell/TopBar.tsx:57-77' },
  backButton: { paints: { color: 'foreground' }, pressed: GHOST_PRESSED, app: 'src/cc/shell/TopBar.tsx:23-55' },
  tabStrip: { paints: { backgroundColor: 'background', borderBottomColor: 'border' }, app: 'src/cc/shell/chrome.ts:75-86' },
  tabActive: { paints: { color: 'foreground', borderBottomColor: 'accent' }, app: 'src/cc/shell/chrome.ts:91-95' },
  tabRest: { paints: { color: 'mutedForeground' }, app: 'src/cc/shell/chrome.ts:91-95' },
  pillSelected: {
    paints: { backgroundColor: 'foreground', borderColor: 'foreground', color: 'card' },
    app: 'src/ui/variants.ts:197-209',
  },
  pillRest: {
    paints: { backgroundColor: 'card', borderColor: 'border', color: 'foreground' },
    pressed: CARD_PRESSED,
    app: 'src/ui/variants.ts:197-209',
  },
  reasonChip: { paints: { backgroundColor: { tint: 'accent', alpha: CHIP_ALPHA }, color: 'accent' }, app: 'src/ui/Chip.tsx:16-35' },
  tag: { paints: { backgroundColor: 'secondary', color: 'mutedForeground' }, app: 'src/cc/board/chrome.ts:37-44' },
} as const satisfies Readonly<Record<string, PartSpec>>

export type StudioPart = keyof typeof STUDIO_PARTS

/** variants.ts TEXT_TONES (:54-:63): a text's tone and the colour it reads. */
export const TEXT_TONES = Object.freeze({
  default: 'foreground', muted: 'mutedForeground', subtle: 'fg3', accent: 'accent', success: 'olive', info: 'navy',
  warning: 'warnInk', inverse: 'primaryForeground',
} as const satisfies Readonly<Record<string, StudioColourName>>)
export type TextTone = keyof typeof TEXT_TONES

/** variants.ts PIP_TOKENS (:258-:269): a status dot's colour. */
export const PIP_COLOURS = Object.freeze({
  inbox: 'foreground', assigned: 'info', in_progress: 'warnInk', review: 'warning', blocked: 'accent', done: 'success',
  failed: 'destructive', cancelled: 'mutedForeground', closed: 'mutedForeground', live: 'ccLiveDot',
} as const satisfies Readonly<Record<string, StudioColourName>>)
export type PipStatus = keyof typeof PIP_COLOURS

/** src/chat/lines.ts MARK_COLOURS (:61-:67): a tool line's or receipt's mark. */
export const MARK_COLOURS = Object.freeze({
  running: 'accent', done: 'olive', failed: 'destructive', waiting: 'accent', muted: 'mutedForeground',
} as const satisfies Readonly<Record<string, StudioColourName>>)
export type MarkTone = keyof typeof MARK_COLOURS

/** The Studio colours each thread box is made from (tokens/thread.ts :15-:25). */
const THREAD_TOKENS: Readonly<Record<keyof ThreadPaint, readonly StudioColourName[]>> = Object.freeze({
  autoFill: ['card'], autoBorder: ['border'], userFill: ['background', 'primary'], userBorder: ['background', 'primary'],
  avatar: ['accent'], sail: ['onStrong'],
})

const isThread = (ref: PaintRef): ref is ThreadRef => typeof ref === 'object' && 'thread' in ref
const isTint = (ref: PaintRef): ref is TintRef => typeof ref === 'object' && 'tint' in ref

/** A paint's colour on these colours. */
export function resolvePaint(ref: PaintRef, colours: StudioColours, thread: ThreadPaint): string {
  if (isThread(ref)) return thread[ref.thread]
  if (isTint(ref)) return tint(colours[ref.tint], ref.alpha)
  return colours[ref]
}

/** The Studio colours a paint reads. */
export function tokensOfPaint(ref: PaintRef): readonly StudioColourName[] {
  if (isThread(ref)) return THREAD_TOKENS[ref.thread]
  return [isTint(ref) ? ref.tint : ref]
}

const given = (entry: [string, PaintRef | undefined]): entry is [PaintSlot, PaintRef] => entry[1] !== undefined

/** A set of paints as [slot, paint] pairs. */
function paintEntries(paints: Paints): [PaintSlot, PaintRef][] {
  return Object.entries(paints).filter(given)
}

function paintsOf(part: StudioPart, state: PartState): Paints {
  const spec: PartSpec = STUDIO_PARTS[part]
  const over = state === 'pressed' ? spec.pressed : state === 'focused' ? spec.focused : undefined
  return { ...spec.paints, ...over }
}

/** A part's CSS colours in a state: its rest's, with the state's laid over them. */
export function partPaint(
  part: StudioPart, colours: StudioColours, thread: ThreadPaint, state: PartState = 'rest',
): Readonly<Partial<Record<PaintSlot, string>>> {
  const entries = paintEntries(paintsOf(part, state)).map(([slot, ref]) => [slot, resolvePaint(ref, colours, thread)])
  return Object.fromEntries(entries) as Partial<Record<PaintSlot, string>>
}

/** The Studio colours a part reads, at rest and in its states. */
export function partTokens(part: StudioPart): readonly StudioColourName[] {
  const spec: PartSpec = STUDIO_PARTS[part]
  const refs = [spec.paints, spec.pressed ?? {}, spec.focused ?? {}].flatMap((paints) => paintEntries(paints).map(([, ref]) => ref))
  return Array.from(new Set(refs.flatMap((ref) => tokensOfPaint(ref))))
}

/** The parts that read `token`, in the table's order. */
export function partsOfToken(token: StudioColourName): readonly StudioPart[] {
  return (Object.keys(STUDIO_PARTS) as StudioPart[]).filter((part) => partTokens(part).includes(token))
}
