"use client";

// Auto: the clip for the reducer's state, the light ring under him and a caption that
// says what he is doing. Spec: skills/build-automatos-interface/references/mascot-states.md
// and docs/design/mocks/mascot.dc.html. The files in public/auto/ are git-ignored and
// may be missing: then he is the dashed placeholder, and the caption still reads.

import { type SyntheticEvent, useCallback, useState } from "react";

import { type MascotPlayer, useMascotPlayer } from "@/hooks/useMascotPlayer";
import { usePrefersReducedMotion, useVideoFormat } from "@/hooks/useMediaPreferences";
import { captionFor, clipUrls, MASCOT_DIR, posterUrl, ringTone, type VideoFormat } from "@/lib/mascot/media";
import type { MascotName } from "@/lib/mascot/types";

import { MascotPlaceholder } from "./MascotPlaceholder";
import styles from "./mascot.module.css";

/** probing: the state's PNG is loading behind the placeholder. */
type AssetStatus = "probing" | "ready" | "missing";

export interface AutoMascotProps {
  /** The reducer's state.mascot. */
  readonly state: MascotName;
  /** Dispatch {type: "clip-ended", state} to the reducer. */
  readonly onClipEnded?: (state: MascotName) => void;
  /** Overrides the caption for the state, e.g. captionFor("celebrate", "report"). */
  readonly caption?: string;
  /** A second caption line, e.g. the search query. */
  readonly detail?: string;
  /** large: the first-open introduction (mock 06); small: the row above the message box on phones (mock 01 phone). */
  readonly size?: "small" | "regular" | "large";
}

export function AutoMascot({ state, onClipEnded, caption, detail, size = "regular" }: AutoMascotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const format = useVideoFormat();
  const [assets, setAssets] = useState<AssetStatus>("probing");
  // One clip that won't play means the set is broken: stills from then on, not a stuck clip.
  const [videoFailed, setVideoFailed] = useState(false);
  const video = !reducedMotion && !videoFailed && assets === "ready" ? format : null;
  const player = useMascotPlayer({ target: state, still: video === null, onClipEnded });

  const onStillLoad = useCallback(() => setAssets("ready"), []);
  const onStillError = useCallback(() => {
    console.warn(`Auto's mascot files aren't in public${MASCOT_DIR}/, so he is a placeholder.`);
    setAssets("missing");
  }, []);
  const onVideoError = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    console.warn(`Auto's clip ${event.currentTarget.src} didn't play, so he is a still.`);
    setVideoFailed(true);
  }, []);

  return (
    <div className={styles.auto} data-size={size}>
      <div className={styles.stage} data-testid="auto-stage" data-ring={ringTone(player.showing)} aria-hidden="true">
        <div className={styles.ring} />
        {assets !== "ready" && <MascotPlaceholder state={player.showing} />}
        {video !== null ? (
          <MascotVideo state={player.showing} format={video} player={player} onError={onVideoError} />
        ) : (
          assets !== "missing" && (
            <MascotStill state={player.showing} loaded={assets === "ready"} onLoad={onStillLoad} onError={onStillError} />
          )
        )}
      </div>
      <p className={styles.caption}>
        <span className={styles.captionTitle}>{caption ?? captionFor(state)}</span>
        {detail && <span className={styles.captionDetail}>{detail}</span>}
      </p>
    </div>
  );
}

interface MascotVideoProps {
  readonly state: MascotName;
  readonly format: VideoFormat;
  readonly player: MascotPlayer;
  readonly onError: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

/** No `loop`: the player restarts loops itself, at the boundary (see lib/mascot/player.ts). */
function MascotVideo({ state, format, player, onError }: MascotVideoProps) {
  const urls = clipUrls(state, format);
  return (
    <video
      key={state}
      className={styles.figure}
      src={urls.video}
      poster={urls.poster}
      autoPlay
      muted
      playsInline
      preload="auto"
      onTimeUpdate={player.onTimeUpdate}
      onEnded={player.onEnded}
      onError={onError}
    />
  );
}

interface MascotStillProps {
  readonly state: MascotName;
  /** False while probing: the image loads unseen behind the placeholder. */
  readonly loaded: boolean;
  readonly onLoad: () => void;
  readonly onError: () => void;
}

/** The state's PNG: the poster, the reduced-motion view, and the probe for the files. */
function MascotStill({ state, loaded, onLoad, onError }: MascotStillProps) {
  // An image that finished before hydration fires no load event: check it on mount.
  const checkLoaded = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth > 0) onLoad();
    },
    [onLoad],
  );
  return (
    // A plain <img>: the file may be missing, and onLoad/onError choose the fallback.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkLoaded}
      className={loaded ? styles.figure : styles.probing}
      src={posterUrl(state)}
      alt=""
      onLoad={onLoad}
      onError={onError}
    />
  );
}
