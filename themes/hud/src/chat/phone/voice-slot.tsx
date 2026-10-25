/**
 * The middle of the phone's control row, kept for the voice button: the Command design's HOLD TO TALK, with MIC LIVE
 * in the top bar and the waveform over the row. The theme SDK has no voice area yet (core adds it next), and HUD never
 * opens the microphone on its own, so this draws nothing today, and TYPE and STOP stand at the row's two ends, where
 * they stay once the button is here. The voice button, the waveform and MIC LIVE arrive with the SDK's voice area.
 */
export function VoiceSlot(): null {
  return null
}
