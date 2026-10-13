// Drives the mascot <video> from the reducer's target state: queues a change until
// the clip boundary, restarts loops, and reports when a one-shot's clip ends. With no
// video (reduced motion, missing files) it shows the target at once and ends
// one-shots on a CLIP_MS timer instead. The queue rules are in lib/mascot/player.ts.

import { type SyntheticEvent, useEffect, useRef, useState } from "react";

import {
  atClipBoundary,
  CLIP_MS,
  clipBoundary,
  jumpTo,
  retarget,
  startPlayer,
} from "@/lib/mascot/player";
import { type MascotName, ONE_SHOTS } from "@/lib/mascot/types";

export interface MascotPlayerOptions {
  /** The reducer's state.mascot. */
  readonly target: MascotName;
  /** No video plays: swap at once. */
  readonly still: boolean;
  /** A one-shot's clip ended; dispatch {type: "clip-ended", state} to the reducer. */
  readonly onClipEnded?: (state: MascotName) => void;
}

export interface MascotPlayer {
  /** The state whose clip (or still) is on screen. */
  readonly showing: MascotName;
  readonly onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void;
  readonly onEnded: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

function restart(video: HTMLVideoElement): void {
  video.currentTime = 0;
  try {
    // Older browsers return undefined instead of a promise.
    Promise.resolve(video.play()).catch((error: unknown) => {
      console.warn("Auto's clip didn't restart", error);
    });
  } catch (error) {
    console.warn("Auto's clip didn't restart", error);
  }
}

export function useMascotPlayer({ target, still, onClipEnded }: MascotPlayerOptions): MascotPlayer {
  const [player, setPlayer] = useState(() => startPlayer(target));
  const onClipEndedRef = useRef(onClipEnded);

  useEffect(() => {
    onClipEndedRef.current = onClipEnded;
  }, [onClipEnded]);

  useEffect(() => {
    setPlayer((current) => (still ? jumpTo(current, target) : retarget(current, target)));
  }, [target, still]);

  useEffect(() => {
    if (!still || !ONE_SHOTS.has(target)) return undefined;
    const timer = window.setTimeout(() => onClipEndedRef.current?.(target), CLIP_MS);
    return () => window.clearTimeout(timer);
  }, [still, target]);

  // Reported from state, not from the event: timeupdate and ended can both land at a
  // one-shot's end, and only the first one finishes it.
  useEffect(() => {
    if (player.finished) onClipEndedRef.current?.(player.showing);
  }, [player.finished, player.showing]);

  const handleBoundary = (video: HTMLVideoElement): void => {
    setPlayer((current) => clipBoundary(current).player);
    // A stale restart is harmless: a swap remounts the <video>, and `ended` retries.
    if (clipBoundary(player).action === "restart") restart(video);
  };

  return {
    showing: still ? target : player.showing,
    onTimeUpdate: (event) => {
      const video = event.currentTarget;
      if (atClipBoundary(video.currentTime, video.duration)) handleBoundary(video);
    },
    onEnded: (event) => handleBoundary(event.currentTarget),
  };
}
