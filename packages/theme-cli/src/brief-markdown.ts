/**
 * The text of a brief (PRD-261 B-04a): BRIEF.md, section by section, in the order of
 * `skills/brand-a-theme/references/brief-template.md` (BRIEF_SECTIONS; the command's test holds the two equal).
 *
 * Every text from the brand kit is already one plain line (brief-kit.ts); here it is only ever written after a
 * prefix, inside a code span with its backticks replaced, or in a table cell with its pipes escaped, so it can't start
 * a heading or a row. The paths and caps a theme's files take are files.ts's, core's reader's own.
 */
import type { Accent, BriefColours, Ground, Pair, TextColour } from './brief-colours.ts'
import { fillReads, formatRatio } from './brief-colours.ts'
import type { BriefKit, FontFile, Logo } from './brief-kit.ts'
import { HTML_CLASS_PATTERN } from './core/host.ts'
import { NAME_MAX, RESERVED_HTML_CLASSES } from './core/package-manifest.ts'
import { FILE_KINDS, KB } from './files.ts'

/** The brief's sections, in order: the `## ` headings of the brief template. */
export const BRIEF_SECTIONS = [
  'Brand', 'Grounds', 'Accents', 'Proposed pairs', 'Fonts', 'Logo variants', 'Voice', 'Theme',
] as const

const BRAND_DIR = 'assets/brand/'
const FONTS_DIR = 'assets/fonts/'
const BRAND_KIT_PATH = '/api/documents/brand-kit'
/** A theme's name: words of lower-case letters and digits joined by single dashes (`automatos-theme new`'s rule). */
const NAME_WORDS = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const NAME_CUT = 32
const ACCENT_USE_WORDS = {
  sparing: 'keep the accent for highlights (links, key numbers, the active item); never fill headers or large areas with it',
  bold: 'the accent may also fill headers and large areas; headings stay in the heading colour',
} as const

/** Inline code; a backtick in the text becomes a quote, so the span can't end early. */
function code(text: string): string {
  return `\`${text.replaceAll('`', "'")}\``
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|')
}

function table(head: readonly string[], rows: readonly (readonly string[])[]): string[] {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)]
}

function ratio(value: number): string {
  return `${formatRatio(value)}:1`
}

/** The cap of a file kind of core's reader, in KB. */
function capKb(kindName: string): number {
  const kind = FILE_KINDS.find((candidate) => candidate.name === kindName)
  if (kind === undefined) throw new Error(`files.ts has no ${kindName} kind.`)
  return kind.cap / KB
}

function brandSection(kit: BriefKit, source: string): string[] {
  const use = kit.accentUse === null ? 'not set' : `${code(kit.accentUse)}: ${ACCENT_USE_WORDS[kit.accentUse]}`
  return [
    `- Name: ${kit.name || 'not set'}`,
    `- Tagline: ${kit.tagline || 'not set'}`,
    `- Accent use: ${use}.`,
    `- Read from: ${code(source)}, the brand kit as the local edition's ${code(`GET ${BRAND_KIT_PATH}`)} answers it.`,
  ]
}

function groundRow(item: Ground): string[] {
  return [item.label, code(item.colour), code(item.triplet), item.tone, code(item.from)]
}

function groundsSection(colours: BriefColours): string[] {
  return [
    'The page grounds are the kit\'s page roles; the other ground is the kit colour that stands furthest from the page,',
    'for a preset of the other tone.',
    '',
    ...table(['Ground', 'Colour', 'Studio triplet', 'Tone', 'From the kit'], [...colours.page, colours.other].map(groundRow)),
  ]
}

function textCell(text: TextColour): string {
  return `${code(text.colour)} ${text.kept ? '(the kit\'s)' : '(mixed to read)'}`
}

function fillCell(accent: Accent): string {
  return accent.fills.map((fill) => `${fill.ground} ${ratio(fill.ratio)}${fillReads(fill) ? '' : ' (under 3:1)'}`).join(', ')
}

function accentsSection(colours: BriefColours): string[] {
  const other = colours.other.label
  return [
    'Each candidate as a fill (a button, a ring, an icon: 3:1 on its ground) and as text (4.5:1). A colour that does',
    'not read as text is mixed toward the ground\'s body text until it does (look-kit\'s `readableOnAll`); the colour',
    'itself stays for fills.',
    '',
    ...table(['Accent', 'Colour', 'Studio triplet', 'From the kit'], colours.accents.map((accent) => [
      accent.label, code(accent.colour), code(accent.triplet), code(accent.from),
    ])),
    '',
    ...table(['Accent', 'As a fill', 'Text on the page grounds', `Text on the ${other}`, 'Label on it'], colours.accents.map((accent) => [
      accent.label, fillCell(accent), textCell(accent.onPage), textCell(accent.onOther), textCell(accent.labelText),
    ])),
  ]
}

function pairRow(pair: Pair): string[] {
  return [pair.text, code(pair.colour), pair.ground, code(pair.groundColour), ratio(pair.ratio)]
}

function pairsSection(colours: BriefColours): string[] {
  const notProposed = colours.notProposed.map((pair) => (
    `- Not proposed: ${pair.text} ${code(pair.colour)} on ${pair.ground} ${code(pair.groundColour)} is ${ratio(pair.ratio)}; pick another colour for that ground.`
  ))
  return [
    'Every pair below reads at 4.5:1 or more (WCAG AA for text), measured with `@automatos/look-kit`. Declare each pair',
    'the theme draws in `design/contrast.json`; `automatos-theme check design` then measures it on every preset.',
    '',
    ...table(['Text', 'Colour', 'On', 'Ground', 'Ratio'], colours.proposed.map(pairRow)),
    ...(notProposed.length === 0 ? [] : ['', ...notProposed]),
  ]
}

/** The first family a CSS font stack names, unquoted. */
function firstFamily(stack: string): string {
  return (stack.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '')
}

/** A file stem of letters, digits and dashes for `text`, or `fallback`. */
function fileStem(text: string, fallback: string): string {
  const stem = text.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return stem === '' ? fallback : stem
}

function fontLine(role: string, stack: string): string {
  return stack === '' ? `- ${role}: not set` : `- ${role}: ${firstFamily(stack)} (${code(stack)})`
}

function fontFileLine(file: FontFile): string {
  const target = `${FONTS_DIR}${fileStem(`${file.family} ${file.weight} ${file.style}`, 'font')}.woff2`
  const named = file.fileName === '' ? '' : ` (${code(file.fileName)})`
  return `  - ${file.family} ${file.weight} ${file.style}${named}: ${code(target)}, from ${code(`GET ${BRAND_KIT_PATH}/fonts/${file.id}`)}`
}

function fontsSection(kit: BriefKit, htmlClass: string): string[] {
  const files = kit.fontFiles.length === 0 ? ['- Font files in the brand kit: none.'] : ['- Font files in the brand kit:', ...kit.fontFiles.map(fontFileLine)]
  const family = fileStem(firstFamily(kit.bodyFont), 'body')
  return [
    fontLine('Body', kit.bodyFont),
    kit.headingFont === '' ? '- Headings: the body font' : fontLine('Headings', kit.headingFont),
    ...files,
    '',
    `A theme ships each face it draws as ${code(`${FONTS_DIR}<name>.woff2`)}, at most ${capKb('font')} KB, listed in`,
    '`theme.json` `fonts`, with its licence beside it as `.txt` or `.md`: only a font whose licence lets you',
    'redistribute it. Without the files, the stack\'s fallbacks draw the text. Each `@font-face` family starts with the',
    `theme's class, such as ${code(`${htmlClass}-${family}`)}.`,
  ]
}

function logoCells(logo: Logo): string[] {
  const target = code(`${BRAND_DIR}${logo.variant.stem}.png`)
  switch (logo.state.kind) {
    case 'uploaded':
      return logo.state.format === 'jpeg' ? ['uploaded, JPEG: convert it to PNG or WebP', target] : [`uploaded, ${logo.state.format === 'png' ? 'PNG' : 'a file'}`, target]
    case 'link':
      return [`a link: ${code(logo.state.url)}`, target]
    case 'none':
      return ['not set', 'none']
  }
}

function logosSection(kit: BriefKit): string[] {
  const clearSpace = kit.clearSpace === null ? [] : ['', `Clear space round the logo: ${kit.clearSpace} of its height.`]
  return [
    ...table(['Variant', 'In the brand kit', 'In the theme'], kit.logos.map((logo) => [logo.variant.label, ...logoCells(logo)])),
    '',
    `An uploaded file comes from the local edition's ${code(`GET ${BRAND_KIT_PATH}/<variant>`)}`,
    `(${kit.logos.map((logo) => code(logo.variant.stem)).join(', ')}); a link is downloaded once and kept as a file,`,
    `since a theme loads nothing from outside its package. ${code(BRAND_DIR)} takes PNG or WebP of at most`,
    `${capKb('brand')} KB (no SVG, no JPEG), and \`theme.json\` names the logo as \`brand.wordmark\`.`,
    ...clearSpace,
  ]
}

function voiceSection(kit: BriefKit): string[] {
  const tone = kit.tone.length === 0 ? ['- Tone: the brand kit sets none.']
    : ['- Tone:', ...kit.tone.map((word) => `  - ${word.word}${word.meaning === '' ? '' : `: ${word.meaning}`}`)]
  return [
    ...tone,
    `- Never write: ${kit.banned.length === 0 ? 'the brand kit lists nothing' : kit.banned.map((phrase) => `"${phrase}"`).join(', ')}`,
    `- Sign-off: ${kit.signOff || 'not set'}`,
    '',
    'The theme\'s own strings (its buttons, empty states, the 404, the look editor) follow this voice. Auto\'s replies',
    'and the host\'s pages are not the theme\'s to write.',
  ]
}

/** `stem` cut to NAME_CUT characters, at the end of a word when it has to be cut inside one. */
function cutAtWord(stem: string): string {
  if (stem.length <= NAME_CUT || stem[NAME_CUT] === '-') return stem.slice(0, NAME_CUT)
  return stem.slice(0, NAME_CUT).replace(/-[^-]*$/, '')
}

/** A theme name from the brand's name, as `automatos-theme new` takes one, or null when none fits. */
export function suggestedName(brandName: string): string | null {
  const cut = cutAtWord(fileStem(brandName, ''))
  const fits = NAME_WORDS.test(cut) && HTML_CLASS_PATTERN.test(cut) && !RESERVED_HTML_CLASSES.includes(cut)
  return fits ? cut : null
}

function themeSection(kit: BriefKit, colours: BriefColours, name: string | null): string[] {
  const pageTone = colours.page[0]?.tone
  const named = name === null
    ? '- Suggested name: none fits the brand\'s name; pick one of 3 to 32 lower-case letters and digits, in words joined by single dashes.'
    : `- Suggested name: ${code(name)}, from the brand's name: the id ${code(`<publisher>/${name}`)}, the \`htmlClass\` ${code(name)}, and \`brand.name\` ${code(kit.name.slice(0, NAME_MAX))}.`
  const tones = pageTone === colours.other.tone
    ? `- Tones: every ground here is ${pageTone}, so one tone: \`"tone": "${pageTone}"\`.`
    : `- Tones: the page grounds are ${pageTone} and the ${colours.other.label} ${colours.other.tone}: at least one preset on each, and \`"tone": "from-look"\` with the ground knob's tone rule in \`boot/prepaint.json\`.`
  return [
    named,
    tones,
    '- Still to decide: the publisher, `base` (`studio` or `classic`), `minWidth`, the core pages it replaces, its own',
    '  routes, the slots it fills, and whether it has a mascot.',
  ]
}

/** BRIEF.md for `kit`, read from the file named `source`. */
export function briefMarkdown(kit: BriefKit, colours: BriefColours, source: string): string {
  const name = suggestedName(kit.name)
  const bodies: Record<(typeof BRIEF_SECTIONS)[number], string[]> = {
    Brand: brandSection(kit, source),
    Grounds: groundsSection(colours),
    Accents: accentsSection(colours),
    'Proposed pairs': pairsSection(colours),
    Fonts: fontsSection(kit, name ?? '<htmlClass>'),
    'Logo variants': logosSection(kit),
    Voice: voiceSection(kit),
    Theme: themeSection(kit, colours, name),
  }
  const intro = `Made by \`automatos-theme brief\` from the brand kit, for a theme that wears the brand. Every colour is \`#rrggbb\`.`
  const sections = BRIEF_SECTIONS.flatMap((section) => ['', `## ${section}`, '', ...bodies[section]])
  return [`# Brief: ${kit.name || 'a brand kit'}`, '', intro, ...sections, ''].join('\n')
}
