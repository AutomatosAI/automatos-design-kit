"use client";

import { type ReactNode, createContext, useContext, useEffect, useMemo } from "react";

import { usePrefersReducedMotion } from "@/hooks/useMediaPreferences";
import { LOOK_VAR_NAMES, applyCssVars, lookToCssVars } from "@/lib/looks/css";
import { DEFAULT_LOOK } from "@/lib/looks/presets";
import { type StorageSource, browserStorage } from "@/lib/looks/storage";
import type { ValidationResult } from "@/lib/looks/types";

import { type LookStore, useLookStore } from "./useLookStore";

// The active Look for the whole app. Its CSS variables live on <html>, so every screen
// follows a change at once. The inline script from lib/looks/prepaint.ts has already set
// them before first paint; this takes over after hydration.

/** On <html>: "reduce" or "full". globals.css stops loops and transitions under "reduce". */
export const MOTION_ATTRIBUTE = "data-motion";
/** On <html>: 0 under reduced motion, 1 otherwise, for CSS that scales motion with calc(). */
export const MOTION_VAR = "--motion";

export interface LookContextValue extends Omit<LookStore, "loaded"> {
  /** The user asks for reduced motion: no loops, no glow crossfade, no rise. */
  readonly reducedMotion: boolean;
}

function missingProvider(action: string): void {
  console.warn(`[looks] ${action} needs a LookProvider above it; nothing changed`);
}

const NO_PROVIDER: ValidationResult = { ok: false, errors: ["Looks aren't available here."] };

// Outside a provider (component tests of a single screen) everything reads as Ember.
const LookContext = createContext<LookContextValue>({
  look: DEFAULT_LOOK,
  saved: [],
  reducedMotion: false,
  setLook: () => missingProvider("setLook"),
  saveLook: () => {
    missingProvider("saveLook");
    return NO_PROVIDER;
  },
  deleteLook: () => missingProvider("deleteLook"),
  renameLook: () => {
    missingProvider("renameLook");
    return NO_PROVIDER;
  },
});

export function useLook(): LookContextValue {
  return useContext(LookContext);
}

function useMotionPreference(reducedMotion: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(MOTION_ATTRIBUTE, reducedMotion ? "reduce" : "full");
    root.style.setProperty(MOTION_VAR, reducedMotion ? "0" : "1");
  }, [reducedMotion]);

  useEffect(
    () => () => {
      document.documentElement.removeAttribute(MOTION_ATTRIBUTE);
      document.documentElement.style.removeProperty(MOTION_VAR);
    },
    [],
  );
}

export interface LookProviderProps {
  readonly children: ReactNode;
  /** Tests pass their own (or one that throws, for blocked storage). */
  readonly storage?: StorageSource;
}

export function LookProvider({ children, storage = browserStorage }: LookProviderProps) {
  const { loaded, look, saved, setLook, saveLook, deleteLook, renameLook } = useLookStore(storage);
  const reducedMotion = usePrefersReducedMotion();

  // Until storage is read, the pre-paint script's variables stand: applying Ember here
  // first would flash the default before the stored Look.
  useEffect(() => {
    if (loaded) applyCssVars(document.documentElement, lookToCssVars(look));
  }, [loaded, look]);

  useEffect(
    () => () => {
      for (const name of LOOK_VAR_NAMES) document.documentElement.style.removeProperty(name);
    },
    [],
  );

  useMotionPreference(reducedMotion);

  const value = useMemo<LookContextValue>(
    () => ({ look, saved, reducedMotion, setLook, saveLook, deleteLook, renameLook }),
    [look, saved, reducedMotion, setLook, saveLook, deleteLook, renameLook],
  );

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}
