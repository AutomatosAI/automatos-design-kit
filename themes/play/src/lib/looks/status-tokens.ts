import type { CssVars } from '@automatos/look-kit/css'

/**
 * PRD-268 §6.12.2 (K13), Play 1.3.0 — the status tokens a Play look paints, beside Studio's tokens: `--success`,
 * `--warning`, `--warn-ink`, `--info` and `--running`, Studio's own Light or Dark values chosen by the ground's tone
 * (engine.ts studioStatusTokens). The host's proactive cards (the brief's rows, a suggestion, a status label) draw a
 * row's state through these names, by the role DISPLAY_STATE_LABELS gives it, so a status reads the same under every
 * look, on every accent, and never takes the accent (under every Play look `--accent` is the error colour).
 *
 * The values are core's look runtime's, frontend/lib/look-kit/studio-tokens.ts STUDIO_STATUS_LIGHT and
 * STUDIO_STATUS_DARK at 1a8956c874dc42cff05b96f431c50b7d722a71aa, which core holds equal to its globals.css `.studio`
 * and `.studio.dark` blocks. They live here, not in @automatos/look-kit, so that only Play's look data changes:
 * test/lib/looks/status-tokens.test.ts measures each on every ground × accent pair. Pure.
 */

export const STATUS_TOKEN_NAMES: readonly string[] = Object.freeze(['--success', '--warning', '--warn-ink', '--info', '--running'])

/** Studio Light's status values, as triplets. */
export const STUDIO_STATUS_LIGHT: CssVars = Object.freeze({
  '--success': '82 30% 33%',
  '--warning': '47 73% 56%',
  '--warn-ink': '38 78% 27%',
  '--info': '213 51% 23%',
  '--running': '40 20% 36%',
})

/** Studio Dark's status values, as triplets. */
export const STUDIO_STATUS_DARK: CssVars = Object.freeze({
  '--success': '82 35% 52%',
  '--warning': '47 70% 60%',
  '--warn-ink': '47 70% 60%',
  '--info': '213 55% 68%',
  '--running': '40 20% 65%',
})

/** The status tokens for a ground's tone: Studio Dark's on a dark ground, Studio Light's on a light one. */
export function statusTokensFor(dark: boolean): CssVars {
  return dark ? STUDIO_STATUS_DARK : STUDIO_STATUS_LIGHT
}
