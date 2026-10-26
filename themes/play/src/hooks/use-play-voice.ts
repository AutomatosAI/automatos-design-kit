'use client'

import { useMemo } from 'react'

import { useVoice } from '@automatos/theme-sdk'

import { type VoicePose, voicePose } from '../lib/voice/voice-pose'

/**
 * Play 1.2.0 — the host's voice session as Play's chat reads it (the SDK's useVoice): Auto's pose while a session
 * runs (lib/voice/voice-pose.ts). The words it heard and spoke are not read here: the host puts them in the
 * conversation's messages. Outside the host's voice (a page with none) useVoice answers the idle snapshot, so there is
 * no pose, and the chat drives Auto as before.
 */

export interface PlayVoice {
  /** Auto's state and caption from the session; null when the chat drives him. */
  readonly pose: VoicePose | null
}

export function usePlayVoice(): PlayVoice {
  const voice = useVoice()
  return useMemo(() => ({ pose: voicePose(voice) }), [voice])
}
