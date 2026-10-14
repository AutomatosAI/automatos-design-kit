// The light ring under Auto: which Look colour it takes in each state. Pure, so it is tested
// without a browser. PRD-002 L-006 (the Ember rule): his light when calm, the accent when busy,
// the fixed error coral for oops, a dusk made from the ground while he sleeps or is lost, and the
// ground's secondary text while loading. components/mascot/mascot.module.css draws the same
// mapping from data-ring; tests/mascot/ring.test.ts holds the two together.

import { lookToCssVars } from "@/lib/looks/css";
import type { Look } from "@/lib/looks/types";

import type { MascotName } from "./types";

/** light: calm; accent: busy; error: oops; dusk: asleep or lost; quiet: loading. */
export type RingTone = "light" | "accent" | "error" | "dusk" | "quiet";

const RING_TONES: Readonly<Record<MascotName, RingTone>> = {
  hello: "light",
  idle: "light",
  listening: "light",
  celebrate: "light",
  thinking: "accent",
  working: "accent",
  searching: "accent",
  reading: "accent",
  oops: "error",
  sleeping: "dusk",
  lost: "dusk",
  loading: "quiet",
};

/** The Look variable (lib/looks/css.ts) each tone's ring is drawn in. */
export const RING_VARS: Readonly<Record<RingTone, string>> = {
  light: "--auto-light",
  accent: "--accent",
  error: "--error",
  dusk: "--auto-dusk",
  quiet: "--ground-text-2",
};

export function ringTone(state: MascotName): RingTone {
  return RING_TONES[state];
}

/** The ring's #rrggbb colour for a state under a Look. */
export function ringColour(state: MascotName, look: Look): string {
  const name = RING_VARS[ringTone(state)];
  const colour = lookToCssVars(look)[name];
  if (colour === undefined) throw new Error(`A Look sets no ${name}`);
  return colour;
}
