// Which clip files Auto plays, the ring colour under him and the caption that says
// what he is doing. Pure, so it is tested without a browser. Spec: the "Assets"
// section of skills/build-automatos-interface/references/mascot-states.md; ring
// colours from docs/design/mocks/mascot.dc.html; captions from the mocks.

import type { MascotName } from "./types";

export type VideoFormat = "mp4" | "webm";

/** Where the mascot files are served from (public/auto/, git-ignored). */
export const MASCOT_DIR = "/auto";

const IOS = /iPhone|iPad|iPod/;
/** Engines whose user agent also says "Safari/". */
const NOT_SAFARI = /Chrome\/|Chromium\/|CriOS\/|FxiOS\/|EdgiOS\/|Edg\/|OPR\/|SamsungBrowser\/|Firefox\/|Android/;

/**
 * Safari and every iOS browser get HEVC with alpha (.mp4), everything else VP9 with
 * alpha (.webm). Chosen by browser, not canPlayType: each plays the other format
 * but drops the alpha channel and shows a black box.
 */
export function videoFormat(userAgent: string, maxTouchPoints = 0): VideoFormat {
  if (IOS.test(userAgent)) return "mp4";
  // iPadOS asks for desktop sites with a Mac user agent; only touch gives it away.
  if (userAgent.includes("Macintosh") && maxTouchPoints > 1) return "mp4";
  return userAgent.includes("Safari/") && !NOT_SAFARI.test(userAgent) ? "mp4" : "webm";
}

export type ClipUrls = { readonly video: string; readonly poster: string };

/** The state's still: the video poster, and all there is under reduced motion. */
export function posterUrl(state: MascotName): string {
  return `${MASCOT_DIR}/${state}.png`;
}

export function clipUrls(state: MascotName, format: VideoFormat): ClipUrls {
  return { video: `${MASCOT_DIR}/${state}.${format}`, poster: posterUrl(state) };
}

/** Ring colours from mascot.dc.html: mint calm, bronze busy, coral help, dusk asleep, violet loading. */
export type RingTone = "mint" | "bronze" | "coral" | "dusk" | "violet";

const RING_TONES: Readonly<Record<MascotName, RingTone>> = {
  hello: "mint",
  idle: "mint",
  listening: "mint",
  celebrate: "mint",
  thinking: "bronze",
  working: "bronze",
  searching: "bronze",
  reading: "bronze",
  oops: "coral",
  sleeping: "dusk",
  lost: "dusk",
  loading: "violet",
};

export function ringTone(state: MascotName): RingTone {
  return RING_TONES[state];
}

/**
 * How bright the page glow behind everything is (Ember style sheet, motion): the accent at
 * rest, brighter while he works, brightest for hello and a finished Deliverable, coral for a
 * snag, and out while he sleeps. app/globals.css crossfades between them over 600 ms.
 */
export type PageGlow = "calm" | "busy" | "bright" | "snag" | "off";

const PAGE_GLOWS: Readonly<Record<MascotName, PageGlow>> = {
  hello: "bright",
  idle: "calm",
  listening: "calm",
  celebrate: "bright",
  thinking: "busy",
  working: "busy",
  searching: "busy",
  reading: "busy",
  oops: "snag",
  sleeping: "off",
  lost: "calm",
  loading: "calm",
};

export function pageGlow(state: MascotName): PageGlow {
  return PAGE_GLOWS[state];
}

/** What Auto is doing, in words: the mascot's text equivalent. */
const CAPTIONS: Readonly<Record<MascotName, string>> = {
  hello: "Hi, I'm Auto.",
  idle: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  working: "Working on it",
  searching: "Searching the web",
  reading: "Reading",
  celebrate: "All done",
  oops: "Something went wrong",
  sleeping: "Automatos isn't running",
  lost: "I can't find that page",
  loading: "Loading",
};

/**
 * The caption for a state. Pass the kind of Deliverable that just landed (for
 * example "report") to get "Your report is ready" while Auto celebrates.
 */
export function captionFor(state: MascotName, deliverableKind?: string): string {
  const kind = deliverableKind?.trim().toLowerCase();
  if (state === "celebrate" && kind) return `Your ${kind} is ready`;
  return CAPTIONS[state];
}
