import daylightJson from "../../skins/daylight/skin.json";
import emberJson from "../../skins/ember/skin.json";
import neonJson from "../../skins/neon/skin.json";
import workshopJson from "../../skins/workshop/skin.json";
import { draftFromSkin, type SkinDraft } from "./model";
import { validateSkin } from "./validate";

// The example skins (PRD-004 K-008), each a source folder in skins/<slug>/ that passes
// `npm run validate` (tests/skins/examples.test.ts). The editor's "Start from <name>" buttons and
// the Examples page read them from here. A draft holds a skin's data, not its files, so each
// skin.json is validated without its preview: the picture is served from the folder by
// app/examples/[slug]/preview.png. Relative imports only (lib/skins runs under tsx too).

export interface ExampleSkin {
  readonly slug: string;
  readonly name: string;
  readonly draft: SkinDraft;
}

/** The query that opens the editor on an example: /?start=<slug>. */
export const START_PARAM = "start";

const SOURCES: readonly unknown[] = [emberJson, daylightJson, workshopJson, neonJson];

function withoutPreview(json: unknown): unknown {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return json;
  return Object.fromEntries(Object.entries(json).filter(([key]) => key !== "preview"));
}

function exampleFrom(json: unknown): ExampleSkin[] {
  const result = validateSkin(withoutPreview(json), []);
  if (!result.ok) {
    // A broken example is a bug in the kit (the tests catch it); the editor still works without it.
    console.error("[skins] an example skin in skins/ isn't valid, so it's left out:", result.errors);
    return [];
  }
  return [{ slug: result.skin.slug, name: result.skin.name, draft: draftFromSkin(result.skin) }];
}

export const EXAMPLE_SKINS: readonly ExampleSkin[] = SOURCES.flatMap(exampleFrom);

export function findExample(slug: string): ExampleSkin | undefined {
  return EXAMPLE_SKINS.find((example) => example.slug === slug);
}

/** Where the Examples page gets an example's picture (its assets/preview.png). */
export function examplePreviewUrl(slug: string): string {
  return `/examples/${encodeURIComponent(slug)}/preview.png`;
}

/** The editor, starting from this example (one undoable step). */
export function startFromHref(slug: string): string {
  return `/?${START_PARAM}=${encodeURIComponent(slug)}`;
}
