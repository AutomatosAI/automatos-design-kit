import type { SkinDraft } from "./model";

// The example skins the editor can start from. Each is a source folder in skins/<slug>/
// (PRD-004 K-008 adds Ember, Daylight, Workshop and Neon): K-008 builds each entry's draft from
// its validated skin.json with draftFromSkin(). The editor shows a "Start from <name>" button for
// every entry, and none while the list is empty.

export interface ExampleSkin {
  readonly slug: string;
  readonly name: string;
  readonly draft: SkinDraft;
}

export const EXAMPLE_SKINS: readonly ExampleSkin[] = [];
