'use client'

import { useMemo } from 'react'

import { useVoice } from '@automatos/theme-sdk'

import { type VoicePose, voicePose, type VoiceWords, voiceWords } from '../lib/voice/voice-pose'

/**
 * Play 1.2.0 — the host's voice session as Play's chat reads it (the SDK's useVoice): Auto's pose while a session
 * runs (lib/voice/voice-pose.ts), and the words it heard and spoke so far. Outside the host's voice (a page with
 * none) useVoice answers the idle snapshot, so there is no pose and no words, and the chat drives Auto as before.
 */

export interface PlayVoice {
  /** Auto's state and caption from the session; null when the chat drives him. */
  readonly pose: VoicePose | null
  /** What the session heard and Auto spoke while it runs; null otherwise. */
  readonly words: VoiceWords | null
}

export function usePlayVoice(): PlayVoice {
  const voice = useVoice()
  return useMemo(() => ({ pose: voicePose(voice), words: voiceWords(voice) }), [voice])
}
