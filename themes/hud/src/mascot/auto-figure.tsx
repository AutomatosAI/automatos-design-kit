import { type SyntheticEvent, useCallback } from 'react'

import { clipUrls, posterUrl, type VideoFormat } from '@automatos/mascot/media'
import type { MascotName } from '@automatos/mascot/types'

import styles from './hud-auto.module.css'
import type { MascotPlayer } from './use-mascot-player'

/**
 * Auto's figure: the state's clip, or its still. After themes/play/src/components/mascot/auto-mascot.tsx
 * (Play 1.1.1), its MascotVideo, MascotStill and startClip, as they are but for the stylesheet. The clip
 * starts by hand as well as by autoPlay, since a browser that blocks autoplay says so only through play()'s
 * promise; blocked, Auto is his still from then on.
 */

/** play()'s refusal when the browser blocks autoplay. */
const AUTOPLAY_BLOCKED = 'NotAllowedError'
/** play()'s refusal when a swap or an unmount cut the start short: the next clip starts itself. */
const START_INTERRUPTED = 'AbortError'

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
}

function startClip(video: HTMLVideoElement, onBlocked: () => void): void {
  const refused = (error: unknown): void => {
    const name = errorName(error)
    if (name === START_INTERRUPTED) return
    if (name === AUTOPLAY_BLOCKED) {
      console.warn("[mascot] The browser blocked Auto's clip, so he is a still.", error)
      onBlocked()
      return
    }
    console.warn("[mascot] Auto's clip didn't start:", error)
  }
  try {
    // Older browsers return undefined instead of a promise.
    Promise.resolve(video.play()).catch(refused)
  } catch (error) {
    refused(error)
  }
}

export interface AutoVideoProps {
  readonly state: MascotName
  readonly format: VideoFormat
  readonly player: MascotPlayer
  readonly onError: (event: SyntheticEvent<HTMLVideoElement>) => void
  readonly onBlocked: () => void
}

/** No `loop`: the player restarts loops itself, at the clip boundary. One <video> per state, by key. */
export function AutoVideo({ state, format, player, onError, onBlocked }: AutoVideoProps) {
  const urls = clipUrls(state, format)
  const startOnMount = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video) startClip(video, onBlocked)
    },
    [onBlocked],
  )
  return (
    <video
      key={state}
      ref={startOnMount}
      className={styles.figure}
      src={urls.video}
      poster={urls.poster}
      autoPlay
      muted
      playsInline
      preload="auto"
      onTimeUpdate={(event) => player.onTimeUpdate(event, state)}
      onEnded={(event) => player.onEnded(event, state)}
      onError={onError}
    />
  )
}

/** The state's still: the poster, and all there is while Auto stands still. */
export function AutoStill({ state }: { readonly state: MascotName }) {
  return <img className={styles.figure} src={posterUrl(state)} alt="" />
}
