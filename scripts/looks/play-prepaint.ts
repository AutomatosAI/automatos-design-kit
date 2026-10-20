// Copied from core (AutomatosAI/automatos-ai) `frontend/lib/theme-host/builtin/play-prepaint.ts` at commit
// ebedc7eb8d7f7f9d032706728a7f420a9e833392 (the same at 0dd8b846e41772c8dd7ef159e4373bcb9419b06a, host
// 1.1.0), the builder core's builtin Play boots from. Only the import paths changed: core's `@/lib/...`
// modules are Play's copies under themes/play/src/lib/, and the table types are ./boot-types.ts.
// compile-looks writes its result as the package's boot/prepaint.json, so the installed package paints
// from the same table as builtin Play. Core's comment below is unchanged; it describes builtin Play, whose
// tone rides its own cookie. The package's table also carries the tone rule (host 1.1.0), which
// compile.ts adds beside this table from lib/looks/tone.ts, so the host's look runtime gives an installed
// look the same tone.
import { GLOW_SCALE, rgbList } from '../../themes/play/src/lib/look-kit/css.ts'
import {
  ACCENTS,
  ACCENT_KEYS,
  GROUND_KEYS,
  LIGHT_KEYS,
  SHELL_KEYS,
  TYPE_STYLE_KEYS,
} from '../../themes/play/src/lib/looks/catalogue.ts'
import {
  GLOW_VAR,
  accentTextVars,
  accentVars,
  fontVars,
  groundVars,
  lightVars,
  safeGlowAlpha,
  shellVars,
  studioAccentTokens,
  studioGroundTokens,
} from '../../themes/play/src/lib/looks/engine.ts'
import { DEFAULT_LOOK } from '../../themes/play/src/lib/looks/presets.ts'
import { GLOW_MAX, GLOW_MIN, type Look } from '../../themes/play/src/lib/looks/types.ts'

import type { PrepaintKnobTable, PrepaintPairTable, PrepaintTable, PrepaintVars } from './boot-types.ts'

/**
 * PRD-260 D4, K3; PRD-261 A-03 — a look's first paint as data. The theme boot script
 * (lib/theme-host/boot.ts, THEME_BOOT_SCRIPT) reads the stored active look and paints it from
 * this table before first paint: Play's --pl-* variables AND Studio's tokens, so a Studio page
 * under Play paints in the look's colours from the first frame. builtin Play's boot
 * (play-boot.ts) carries it; nothing else does. Host code, so it sits here and not in Play's
 * lib/looks (W-A5): it builds the host's boot tables (../boot-types), and an installed theme
 * ships the same tables as data in its package instead (A-16c compiles Play's).
 *
 * Every entry is built here from the catalogue through the same builders as lookToCssVars() and
 * lookToStudioTokens(), so the two can never drift. The script paints a stored look only after
 * every field is checked against these tables' own keys (and the schema and interface, the
 * boot's lookGuard); anything else, a corrupt or blocked store included, gets the default look.
 * The glow is a numeric rule, painted as glowVars() paints it: never past the ground and
 * accent's safe glow (the caps, from safeGlowAlpha(), M50).
 *
 * The tone is not set from here: next-themes' own script runs later in <body> and owns the
 * light/dark class, so the tone reaches the first paint through its cookie, the boot's tone and
 * ThemeProvider's forcedTheme (lib/looks/tone.ts).
 */

/** The look fields each part of the table is keyed by. */
type KnobField = keyof Pick<Look, 'ground' | 'accent' | 'font' | 'shell' | 'light'>
const GROUND: KnobField = 'ground'
const ACCENT: KnobField = 'accent'
const GLOW: keyof Pick<Look, 'glow'> = 'glow'

function table<K extends string, V>(keys: readonly K[], value: (key: K) => V): Readonly<Record<string, V>> {
  return Object.fromEntries(keys.map((key) => [key, value(key)]))
}

function knobTables(): Readonly<Record<KnobField, PrepaintKnobTable>> {
  return {
    ground: table(GROUND_KEYS, (key) => ({ ...groundVars(key), ...studioGroundTokens(key) })),
    accent: table(ACCENT_KEYS, accentVars),
    font: table(TYPE_STYLE_KEYS, fontVars),
    shell: table(SHELL_KEYS, shellVars),
    light: table(LIGHT_KEYS, lightVars),
  }
}

/** The accent as text on each ground, and Studio's --primary for the pair. */
function accentTextTable(): PrepaintPairTable<PrepaintVars> {
  return table(GROUND_KEYS, (ground) =>
    table(ACCENT_KEYS, (accent) => ({ ...accentTextVars(ground, accent), ...studioAccentTokens(ground, accent) })),
  )
}

/** Every catalogue entry's variables, keyed the way the boot script reads a stored look. */
export function lookPrepaintTable(): PrepaintTable {
  const { ground, accent, font, shell, light, glow } = DEFAULT_LOOK
  return {
    knobs: knobTables(),
    pairs: [{ a: GROUND, b: ACCENT, table: accentTextTable() }],
    numeric: [
      {
        var: GLOW_VAR,
        knob: GLOW,
        min: GLOW_MIN,
        max: GLOW_MAX,
        integer: true,
        scale: GLOW_SCALE,
        capTable: [GROUND, ACCENT],
        caps: table(GROUND_KEYS, (key) => table(ACCENT_KEYS, (other) => safeGlowAlpha(key, other))),
        color: { knob: ACCENT, rgb: table(ACCENT_KEYS, (key) => rgbList(ACCENTS[key].hex)) },
        template: 'rgba-alpha',
      },
    ],
    defaults: { ground, accent, font, shell, light, glow },
  }
}
