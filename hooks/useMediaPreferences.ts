// Browser facts the mascot player and the chat layout need. The mascot ones read as
// "no video" on the server, so the first paint is the still (or the placeholder) and
// the video starts after hydration.

import { useCallback, useSyncExternalStore } from "react";

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

/** Whether a media query matches now; serverValue on the server and where matchMedia is missing. */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (!hasMatchMedia()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const matchesNow = useCallback(
    (): boolean => (hasMatchMedia() ? window.matchMedia(query).matches : serverValue),
    [query, serverValue],
  );
  return useSyncExternalStore(subscribe, matchesNow, () => serverValue);
}
