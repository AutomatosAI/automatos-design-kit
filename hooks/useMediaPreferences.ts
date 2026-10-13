// Browser facts the mascot player needs. Both read as "no video" on the server, so
// the first paint is the still (or the placeholder) and the video starts after
// hydration.

import { useSyncExternalStore } from "react";

import { type VideoFormat, videoFormat } from "@/lib/mascot/media";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const hasMatchMedia = (): boolean => typeof window.matchMedia === "function";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined;
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const reducedMotionNow = (): boolean => hasMatchMedia() && window.matchMedia(REDUCED_MOTION).matches;

/** True when the user asks for reduced motion (and on the server). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => true);
}

const noSubscription = (): (() => void) => () => undefined;

const formatNow = (): VideoFormat => videoFormat(navigator.userAgent, navigator.maxTouchPoints ?? 0);

/** The clip format for this browser; null on the server. */
export function useVideoFormat(): VideoFormat | null {
  return useSyncExternalStore(noSubscription, formatNow, () => null);
}
