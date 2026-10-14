// No input for a while sends Auto to sleep; any input wakes him (mascot-states.md:
// sleeping after 3 minutes without input). Timers live here, never in the reducer.

import { useEffect, useRef } from "react";

export const IDLE_MS = 3 * 60 * 1000;

/** What counts as input: a key, a click or tap, the pointer moving, a scroll wheel. */
const INPUT_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"] as const;

/**
 * onIdle fires after ms without input, and again every ms while nothing happens (a turn
 * that was running the first time may have ended since). onActive fires on the first
 * input after onIdle.
 */
export function useIdleTimeout(onIdle: () => void, onActive: () => void, ms: number = IDLE_MS): void {
  const handlers = useRef({ onIdle, onActive });

  useEffect(() => {
    handlers.current = { onIdle, onActive };
  }, [onIdle, onActive]);

  useEffect(() => {
    let idle = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        idle = true;
        handlers.current.onIdle();
        arm();
      }, ms);
    };
    const onInput = () => {
      if (idle) {
        idle = false;
        handlers.current.onActive();
      }
      arm();
    };
    arm();
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput);
    };
  }, [ms]);
}
