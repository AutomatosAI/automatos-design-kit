"use client";

// Auto: the clip for the reducer's state, the light ring under him and a caption that
// says what he is doing. Spec: skills/build-automatos-interface/references/mascot-states.md
// and docs/design/mocks/mascot.dc.html. The files in public/auto/ are git-ignored and
// may be missing: then he is the dashed placeholder, and the caption still reads.
// Screen readers skip the picture (aria-hidden) and hear the caption, a polite live
// region, whenever what he is doing changes.

import { type SyntheticEvent, useCallback, useEffect, useState } from "react";

import { type MascotPlayer, useMascotPlayer } from "@/hooks/useMascotPlayer";
import { usePrefersReducedMotion, useVideoFormat } from "@/hooks/useMediaPreferences";
import { AUTO_SOURCE, captionFor, MASCOT_DIR, pageGlow, type MascotSource, type VideoFormat } from "@/lib/mascot/media";
import { ringTone } from "@/lib/mascot/ring";
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
  /** False when the page already says it in words (the first-open headline). */
  readonly showCaption?: boolean;
  /** Where the clips come from: Auto's own (public/auto/) unless a skin brings its own set. */
  readonly source?: MascotSource;
}

export function AutoMascot({
  state,
  onClipEnded,
  caption,
  detail,
  size = "regular",
  showCaption = true,
  source = AUTO_SOURCE,
}: AutoMascotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const format = useVideoFormat();
  const [assets, setAssets] = useState<AssetStatus>("probing");
  // One clip that won't play means the set is broken: stills from then on, not a stuck clip.
  const [videoFailed, setVideoFailed] = useState(false);
  const [player, video] = usePlayerFor(state, source, { reducedMotion, videoFailed, assets, format, onClipEnded });
  const poster = source.poster(player.showing);
  const ready = assets === "ready" && poster !== null;

  const onStillLoad = useCallback(() => setAssets("ready"), []);
  const ownClips = source === AUTO_SOURCE;
  const onStillError = useCallback(() => {
    console.warn(
      ownClips
        ? `Auto's mascot files aren't in public${MASCOT_DIR}/, so he is a placeholder.`
        : "This mascot set's still didn't load, so the placeholder shows.",
    );
    setAssets("missing");
  }, [ownClips]);
  const onVideoError = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    console.warn(`Auto's clip ${event.currentTarget.src} didn't play, so he is a still.`);
    setVideoFailed(true);
  }, []);

  return (
    <div className={styles.auto} data-size={size}>
      {/* data-glow: app/globals.css lights the page behind everything from it (body:has). */}
      <div
        className={styles.stage}
        data-testid="auto-stage"
        data-ring={ringTone(player.showing)}
        data-glow={pageGlow(player.showing)}
        aria-hidden="true"
      >
        <div className={styles.ring} />
        {!ready && <MascotPlaceholder state={player.showing} />}
        {video !== null && poster !== null ? (
          <MascotVideo state={player.showing} src={video} poster={poster} player={player} onError={onVideoError} />
        ) : (
          assets !== "missing" &&
          poster !== null && (
            <MascotStill src={poster} loaded={assets === "ready"} onLoad={onStillLoad} onError={onStillError} />
          )
        )}
      </div>
      {showCaption && (
        <p className={styles.caption} aria-live="polite" aria-atomic="true">
          <span className={styles.captionTitle}>{caption ?? captionFor(state)}</span>
          {detail && <span className={styles.captionDetail}>{detail}</span>}
        </p>
      )}
    </div>
  );
}

interface PlayerInputs {
  readonly reducedMotion: boolean;
  readonly videoFailed: boolean;
  readonly assets: AssetStatus;
  readonly format: VideoFormat | null;
  readonly onClipEnded?: (state: MascotName) => void;
}

/**
 * The player, and the clip URL to play (null: a still). The clip is chosen for the state the
 * player is showing, so a set without a clip for the next state falls back to stills only
 * once the player gets there.
 */
function usePlayerFor(
  state: MascotName,
  source: MascotSource,
  { reducedMotion, videoFailed, assets, format, onClipEnded }: PlayerInputs,
): readonly [MascotPlayer, string | null] {
  const [clipMissing, setClipMissing] = useState(false);
  const canPlay = !reducedMotion && !videoFailed && !clipMissing && assets === "ready" && format !== null;
  const player = useMascotPlayer({ target: state, still: !canPlay, onClipEnded });
  const clip = canPlay && format !== null ? source.video(player.showing, format) : null;
  useEffect(() => {
    if (canPlay && clip === null) setClipMissing(true);
  }, [canPlay, clip]);
  return [player, clip];
}

interface MascotVideoProps {
  readonly state: MascotName;
  readonly src: string;
  readonly poster: string;
  readonly player: MascotPlayer;
  readonly onError: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

/** No `loop`: the player restarts loops itself, at the boundary (see lib/mascot/player.ts). */
function MascotVideo({ state, src, poster, player, onError }: MascotVideoProps) {
  return (
    <video
      key={state}
      className={styles.figure}
      src={src}
      poster={poster}
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
  readonly src: string;
  /** False while probing: the image loads unseen behind the placeholder. */
  readonly loaded: boolean;
  readonly onLoad: () => void;
  readonly onError: () => void;
}

/** The state's PNG: the poster, the reduced-motion view, and the probe for the files. */
function MascotStill({ src, loaded, onLoad, onError }: MascotStillProps) {
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
      src={src}
      alt=""
      onLoad={onLoad}
      onError={onError}
    />
  );
}
