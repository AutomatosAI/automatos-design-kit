import { basePalette } from "./base";
import { skinSelectors, skinToCss } from "./css";
import { SKIN_SCHEMA, TONES, type Skin, type SkinBase, type Tone, type TokenValues } from "./format";
import type { SkinDraft } from "./model";

// The editor's live preview stylesheet. Studio puts a skin on <html data-skin>; the kit shows it
// on preview frames inside its own page instead, so skinToCss's two selectors are moved onto
// the frame: html[data-skin="x"] becomes [data-skin-preview~="x"] and html.dark[data-skin="x"]
// becomes [data-skin-tone="dark"][data-skin-preview~="x"]. A frame names two skins, its base
// palette then the draft, e.g. data-skin-preview="kit-base-studio kit-draft".
//
// Both stylesheets come from skinToCss, so the preview applies the skin exactly as Studio will:
// the draft's light rule (one attribute) loses to the base's dark rule (two) in a dark frame, as
// html[data-skin] loses to .studio.dark in Studio. skinToCss throws on anything unvalidated;
// here that is logged and that stylesheet left out. Pure; relative imports only.

export const PREVIEW_ATTRIBUTE = "data-skin-preview";
export const TONE_ATTRIBUTE = "data-skin-tone";
/** The id the draft's rules are written for (never the skin's slug, which the user is typing). */
export const DRAFT_PREVIEW_ID = "kit-draft";

export function baseScopeId(base: SkinBase): string {
  return `kit-base-${base}`;
}

/** Studio's own classes on <html> (PRD-259 §4): `studio` for the Studio base (none for Classic). */
export const STUDIO_CLASS = "studio";
/** next-themes' class for the Dark tone. */
export const DARK_CLASS = "dark";

/** The classes Studio would put on <html> for a base and a tone; the preview frames carry them too. */
export function studioClasses(base: SkinBase, tone: Tone): readonly string[] {
  return [...(base === "studio" ? [STUDIO_CLASS] : []), ...(tone === "dark" ? [DARK_CLASS] : [])];
}

/** The value of a frame's data-skin-preview: its base palette, then the draft over it. */
export function frameSkins(base: SkinBase): string {
  return `${baseScopeId(base)} ${DRAFT_PREVIEW_ID}`;
}

function toneTokens(tones: readonly Tone[], values: (tone: Tone) => TokenValues): Skin["tokens"] {
  return {
    ...(tones.includes("light") ? { light: values("light") } : {}),
    ...(tones.includes("dark") ? { dark: values("dark") } : {}),
  };
}

/** The draft in the shape skinToCss takes. Not validated: skinToCss refuses anything unsafe itself. */
export function draftAsSkin(draft: SkinDraft, slug: string = DRAFT_PREVIEW_ID): Skin {
  const { meta } = draft;
  return {
    schema: SKIN_SCHEMA,
    slug,
    name: meta.name,
    version: meta.version,
    author: meta.author,
    base: draft.base,
    tones: draft.tones,
    tokens: toneTokens(draft.tones, (tone) => draft.tokens[tone]),
    fonts: draft.fonts,
    shape: draft.shape,
    mascot: draft.mascot,
  };
}

/** A base's own palettes, both tones, as a skin: the ground every preview frame starts from. */
function baseAsSkin(base: SkinBase): Skin {
  return {
    schema: SKIN_SCHEMA,
    slug: baseScopeId(base),
    name: base,
    version: "1.0.0",
    author: "Automatos",
    base,
    tones: TONES,
    tokens: toneTokens(TONES, (tone) => basePalette(base, tone)),
  };
}

/** Moves a skin's rules from <html> onto the preview frames that name `id`. */
export function scopeToFrame(css: string, id: string): string {
  const { light, dark } = skinSelectors(id);
  const frame = `[${PREVIEW_ATTRIBUTE}~="${id}"]`;
  return css.split(dark).join(`[${TONE_ATTRIBUTE}="dark"]${frame}`).split(light).join(frame);
}

function cssOrNothing(make: () => string, what: string): string {
  try {
    return make();
  } catch (error) {
    console.error(`[skins] ${what} couldn't be turned into CSS, so the preview leaves it out:`, error);
    return "";
  }
}

/**
 * The preview's stylesheet: a base palette, then the draft over it, both made by skinToCss. The
 * base is the draft's own unless the preview gallery asks to see the skin over the other one.
 */
export function previewCss(draft: SkinDraft, onBase: SkinBase = draft.base): string {
  const baseId = baseScopeId(onBase);
  const base = cssOrNothing(() => scopeToFrame(skinToCss(baseAsSkin(onBase)), baseId), `The ${onBase} palette`);
  const own = cssOrNothing(() => scopeToFrame(skinToCss(draftAsSkin(draft)), DRAFT_PREVIEW_ID), "The draft");
  return `${base}${own}`;
}
