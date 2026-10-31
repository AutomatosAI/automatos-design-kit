/**
 * The layers each Gradient choice lays over a card's linear gradient (the white highlight's place, colour and reach,
 * Vivid's two corner glows, and where the middle stop sits), so the style sheet can draw Soft, Rich and Vivid side by
 * side whatever the active look picks: the very values boot/prepaint.json paints for the active look, which each row
 * sets on itself and its cards compose (style.module.css .gradientCard).
 */
import { GRADIENT_LAYERS } from '../looks/prepaint'

export const GRADIENTS = ['soft', 'rich', 'vivid'] as const
export type GradientName = (typeof GRADIENTS)[number]

export const CARD_LAYERS: Readonly<Record<GradientName, Readonly<Record<string, string>>>> = GRADIENT_LAYERS
