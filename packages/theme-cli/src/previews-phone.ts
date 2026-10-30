/**
 * `automatos-theme previews <theme folder> --phone <screenshots folder> [--pick <name>=<file>]...`: Automatos Go
 * screenshots copied into the theme's phone screenshots, assets/previews/phone/, and theme.json's `phonePreviews` set
 * to them in the order given. Core's Marketplace storefront shows them beside the web previews, each under its look
 * by the web's rule (listings.py `_claimed`): the name `<preset>` or `<preset>-<screen>`, the longest preset id first.
 * The listing card's phone cover is the first one listed.
 *
 * The screenshots come from the phone, not from the harness: take them in Automatos Go with the theme installed, one
 * look at a time, and put them in one folder. A pick names a screenshot and the file it is, a path under that folder:
 * `--pick ember-chat=IMG_0042.PNG`. The file is a PNG or a JPEG, by its first bytes (files.ts's phone-preview kinds),
 * at most 512 KB, and its package path takes the extension its bytes give, `.png` or `.jpg`, whatever the file is
 * called. With no --pick, every .png, .jpg or .jpeg file right in the folder is a pick, named by its file name without
 * the extension, the default look's first, then each look in the harness's order, each look's in name order; a name
 * no preset claims is refused, as with --pick. A screenshot that is wider than it is tall is written with a warning:
 * the storefront draws it in a portrait phone frame (core checks no size). Nothing is sent anywhere.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { presetOrder } from '@automatos/theme-harness/router'
import { PHONE_PREVIEWS_FIELD } from './check-package.ts'
import { ownerPreset, PHONE_PREVIEW_DIR } from './check/previews.ts'
import { byText } from './collect.ts'
import { PRESETS_DIR } from './looks.ts'
import { pictureSize } from './picture-size.ts'
import { formatsOf, isFile, type Preview, type PreviewPick, type PreviewTarget, type Theme } from './previews-pick.ts'

const PHONE_KIND = 'phone-preview'
const PHONE_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({ 'image/png': '.png', 'image/jpeg': '.jpg' })
/** A picture file the default picks take, its stem captured: any case, `.jpeg` too (its package path is `.jpg`). */
const PICTURE_FILE = /^(.+)\.(?:png|jpe?g)$/i

/** With no --pick: every picture file right in `folder`, by its look (the default look's first), then by name. */
export function defaultPhonePicks(theme: Theme, folder: string): readonly PreviewPick[] | string {
  if (theme.presets.length === 0) {
    return `the theme has no preset in ${PRESETS_DIR}, and a phone screenshot belongs to one: build the theme first.`
  }
  const picks = readdirSync(folder)
    .filter((file) => !file.startsWith('.') && isFile(join(folder, file)))
    .flatMap((file): PreviewPick[] => {
      const stem = PICTURE_FILE.exec(file)?.[1]
      return stem === undefined ? [] : [{ name: stem, shot: file }]
    })
  if (picks.length === 0) {
    return `${folder} holds no .png, .jpg or .jpeg file: put the theme's Automatos Go screenshots there, named `
      + '<preset> or <preset>-<screen>, or pick each with --pick <name>=<file>.'
  }
  const look = typeof theme.document.look === 'string' ? theme.document.look : undefined
  const order = presetOrder(theme.presets, look)
  const rank = (name: string): number => {
    const owner = ownerPreset(name, theme.presets)
    return owner === null ? order.length : order.indexOf(owner.preset)
  }
  return [...picks].sort((a, b) => rank(a.name) - rank(b.name) || byText(a.name, b.name))
}

/** A warning for a screenshot whose header says it is wider than it is tall, else null. */
export function landscapeWarning(preview: Preview): string | null {
  const size = pictureSize(preview.data)
  if (size === null || size.height > size.width) return null
  return `${preview.path} is ${size.width} by ${size.height} pixels, not portrait: the Marketplace draws a phone `
    + 'screenshot in a portrait phone frame, so take it with the phone held upright.'
}

/** Automatos Go's list: theme.json's `phonePreviews`, PNGs and JPEGs in assets/previews/phone/. */
export const PHONE_TARGET: PreviewTarget = Object.freeze({
  field: PHONE_PREVIEWS_FIELD,
  folder: PHONE_PREVIEW_DIR,
  formats: formatsOf(PHONE_KIND, PHONE_EXTENSIONS),
  noun: 'phone screenshot',
  pathShape: `${PHONE_PREVIEW_DIR}<name>.png or .jpg`,
  notPicture: 'its bytes are not a PNG or a JPEG image',
  folderWord: 'screenshots folder',
  fileWord: 'file',
  coverWord: "the listing's phone cover",
  notAFolder: (folder: string) => `${folder} is not a folder: --phone takes the folder that holds the phone screenshots.`,
  defaultPicks: defaultPhonePicks,
  warning: landscapeWarning,
})
