// Copied from themes/play/src/hooks/use-media-preferences.ts (Play 1.1.1): its useVideoFormat, as it is. HUD reads
// reduced motion from the SDK's useMediaPreferences, so Play's own reduced-motion hook is not copied.
import { useSyncExternalStore } from 'react'

import { videoFormat, type VideoFormat } from '@automatos/mascot/media'

const noSubscription = (): (() => void) => () => undefined

const formatNow = (): VideoFormat => videoFormat(navigator.userAgent, navigator.maxTouchPoints ?? 0)

const formatOnServer = (): VideoFormat | null => null

/** The clip format for this browser (@automatos/mascot's media.ts); null on the server. */
export function useVideoFormat(): VideoFormat | null {
  return useSyncExternalStore(noSubscription, formatNow, formatOnServer)
}
