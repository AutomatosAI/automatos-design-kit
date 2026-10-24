import { LOOK_INTERFACE, LOOK_SCHEMA, type HudLook } from './types'

/**
 * HUD's five presets, the Command design's (its looks/presets/*.look.json in the kit's references, which the
 * package ships byte for byte as looks/presets/): one per page of "Automatos Command Pages.dc.html", and ARC,
 * the core screen's, the default. test/look-data.test.ts holds each to its file.
 */

type PresetFields = Omit<HudLook, 'schema' | 'interface' | 'sub'>

function preset(fields: PresetFields): HudLook {
  return { schema: LOOK_SCHEMA, interface: LOOK_INTERFACE, ...fields, sub: '' }
}

export const ARC: HudLook = preset({ id: 'arc', name: 'ARC', ground: 'void', accent: 'arc', font: 'raj', grid: 14, glow: 22, scan: 'on', auto: 'on', motion: 'on' })
export const FORGE: HudLook = preset({ id: 'forge', name: 'FORGE', ground: 'ember', accent: 'forge', font: 'chakra', grid: 8, glow: 26, scan: 'off', auto: 'on', motion: 'on' })
export const GHOST: HudLook = preset({ id: 'ghost', name: 'GHOST', ground: 'carbon', accent: 'ghost', font: 'mono', grid: 6, glow: 8, scan: 'off', auto: 'off', motion: 'on' })
export const NOVA: HudLook = preset({ id: 'nova', name: 'NOVA', ground: 'navy', accent: 'nova', font: 'chakra', grid: 16, glow: 30, scan: 'on', auto: 'on', motion: 'on' })
export const SIGNAL: HudLook = preset({ id: 'signal', name: 'SIGNAL', ground: 'void', accent: 'signal', font: 'mono', grid: 22, glow: 18, scan: 'on', auto: 'off', motion: 'on' })

/** In the design's order, the default first. */
export const PRESETS: readonly HudLook[] = [ARC, FORGE, GHOST, NOVA, SIGNAL]

export const DEFAULT_LOOK: HudLook = ARC

export function findPreset(id: string): HudLook | undefined {
  return PRESETS.find((look) => look.id === id)
}

export function isPresetId(id: string): boolean {
  return findPreset(id) !== undefined
}
