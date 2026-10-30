import { LAYER_COLOURS } from '../looks/catalogue'

/**
 * The layers each Gradient choice lays over a card's linear gradient (the white highlight, Vivid's two corner glows,
 * and where the middle stop sits), so the style sheet can draw Soft, Rich and Vivid side by side whatever the active
 * look picks. The same recipe boot/prepaint.json paints for the active look (src/looks/prepaint.ts's gradient knob);
 * test/style.test.tsx holds the two equal. Every colour comes from the catalogue. Pure.
 */

export const GRADIENTS = ['soft', 'rich', 'vivid'] as const
export type GradientName = (typeof GRADIENTS)[number]

const { highlight, highlightVivid, glowPink, glowCyan } = LAYER_COLOURS
const SOFT_HIGHLIGHT = `radial-gradient(circle at 88% 8%,${highlight},transparent 46%)`

export const CARD_LAYERS: Readonly<Record<GradientName, Readonly<Record<string, string>>>> = {
  soft: {
    '--candy-card-hi': SOFT_HIGHLIGHT,
    '--candy-card-glow': 'none',
    '--candy-card-mid': '100%',
  },
  rich: {
    '--candy-card-hi': SOFT_HIGHLIGHT,
    '--candy-card-glow': 'none',
    '--candy-card-mid': '55%',
  },
  vivid: {
    '--candy-card-hi': `radial-gradient(circle at 92% 0%,${highlightVivid},transparent 50%)`,
    '--candy-card-glow': `radial-gradient(circle at 0% 100%,${glowPink},transparent 55%),radial-gradient(circle at 100% 100%,${glowCyan},transparent 50%)`,
    '--candy-card-mid': '55%',
  },
}
