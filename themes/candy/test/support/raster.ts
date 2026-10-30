// Auto's stills for the phone, drawn from his geometry (src/art/auto-geometry.ts) the way the web's SVG draws it:
// each part's paints, bottom first, composited over a clear ground in premultiplied colour. Coverage is sampled 4 × 4
// per pixel for smooth edges; a gradient is read at the pixel's centre; a part's glow is its coverage blurred (three
// box passes, near a Gaussian of half the glow's blur) under it. The body's drop shadow is the web's alone: a still
// sits on whatever ground the phone has. Pure arithmetic, no trigonometry, so every machine draws the same pixels.
import type { MascotName } from '@automatos/mascot/types'

import { AUTO_BOX, autoParts, type Paint, type Part, type RoundRect, type Stop } from '../../src/art/auto-geometry.ts'
import { archBoxes } from '../../src/art/auto-path.ts'
import { AUTO_COLOURS } from '../../src/looks/catalogue.ts'

export interface Raster {
  readonly width: number
  readonly height: number
  readonly pixels: Buffer
}

type Rgba = [number, number, number, number]

const SAMPLES = 4

function hexRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** A stop as premultiplied 0..1 colour. */
function stopColour(stop: Pick<Stop, 'colour' | 'alpha'>): Rgba {
  const [r, g, b] = hexRgb(AUTO_COLOURS[stop.colour])
  return [(r / 255) * stop.alpha, (g / 255) * stop.alpha, (b / 255) * stop.alpha, stop.alpha]
}

function along(stops: readonly Stop[], t: number): Rgba {
  if (t <= stops[0].at) return stopColour(stops[0])
  const last = stops[stops.length - 1]
  if (t >= last.at) return stopColour(last)
  const next = stops.findIndex((stop) => stop.at >= t)
  const [from, to] = [stops[next - 1], stops[next]]
  const k = to.at === from.at ? 1 : (t - from.at) / (to.at - from.at)
  const [a, b] = [stopColour(from), stopColour(to)]
  return [0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * k) as Rgba
}

function paintAt(paint: Paint, x: number, y: number): Rgba {
  if (paint.kind === 'solid') return stopColour(paint)
  if (paint.kind === 'radial') return along(paint.stops, Math.sqrt((x - paint.cx) ** 2 + (y - paint.cy) ** 2) / paint.r)
  const [dx, dy] = [paint.x2 - paint.x1, paint.y2 - paint.y1]
  return along(paint.stops, ((x - paint.x1) * dx + (y - paint.y1) * dy) / (dx * dx + dy * dy))
}

function inCorner(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  return rx <= 0 || ry <= 0 || ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
}

function inRoundRect(box: RoundRect, x: number, y: number): boolean {
  if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) return false
  const [tl, tr, br, bl] = box.rx
  const [tlY, trY, brY, blY] = box.ry
  const right = box.x + box.w
  const bottom = box.y + box.h
  if (x < box.x + tl && y < box.y + tlY) return inCorner(x, y, box.x + tl, box.y + tlY, tl, tlY)
  if (x > right - tr && y < box.y + trY) return inCorner(x, y, right - tr, box.y + trY, tr, trY)
  if (x > right - br && y > bottom - brY) return inCorner(x, y, right - br, bottom - brY, br, brY)
  if (x < box.x + bl && y > bottom - blY) return inCorner(x, y, box.x + bl, bottom - blY, bl, blY)
  return true
}

function inside(part: Part, x: number, y: number): boolean {
  if (part.shape.kind === 'rrect') return inRoundRect(part.shape, x, y)
  const [outer, inner] = archBoxes(part.shape)
  return inRoundRect(outer, x, y) && !inRoundRect(inner, x, y)
}

interface Canvas {
  readonly size: number
  readonly scale: number
  /** Premultiplied RGBA, 0..1. */
  readonly data: Float64Array
}

const toBox = (canvas: Canvas, pixel: number): number => AUTO_BOX.x + pixel / canvas.scale
const toBoxY = (canvas: Canvas, pixel: number): number => AUTO_BOX.y + pixel / canvas.scale

/** The pixels a box covers, with a margin, clamped to the canvas. */
function pixelSpan(canvas: Canvas, part: Part, margin: number): [number, number, number, number] {
  const { x, y, w, h } = part.shape
  const left = Math.max(0, Math.floor((x - AUTO_BOX.x - margin) * canvas.scale))
  const top = Math.max(0, Math.floor((y - AUTO_BOX.y - margin) * canvas.scale))
  const right = Math.min(canvas.size, Math.ceil((x + w - AUTO_BOX.x + margin) * canvas.scale))
  const bottom = Math.min(canvas.size, Math.ceil((y + h - AUTO_BOX.y + margin) * canvas.scale))
  return [left, top, right, bottom]
}

/** How much of each pixel the part covers, 0..1, sampled SAMPLES × SAMPLES. */
function coverage(canvas: Canvas, part: Part): Float64Array {
  const mask = new Float64Array(canvas.size * canvas.size)
  const [left, top, right, bottom] = pixelSpan(canvas, part, 1)
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          if (inside(part, toBox(canvas, px + (sx + 0.5) / SAMPLES), toBoxY(canvas, py + (sy + 0.5) / SAMPLES))) hits += 1
        }
      }
      mask[py * canvas.size + px] = hits / (SAMPLES * SAMPLES)
    }
  }
  return mask
}

/** One box-blur pass of `radius` px, along rows or columns. */
function boxPass(mask: Float64Array, size: number, radius: number, rows: boolean): Float64Array {
  const out = new Float64Array(mask.length)
  const at = (line: number, step: number) => (rows ? line * size + step : step * size + line)
  for (let line = 0; line < size; line += 1) {
    let sum = 0
    for (let step = -radius; step <= radius; step += 1) sum += step >= 0 && step < size ? mask[at(line, step)] : 0
    for (let step = 0; step < size; step += 1) {
      out[at(line, step)] = sum / (radius * 2 + 1)
      const leaving = step - radius
      const entering = step + radius + 1
      if (leaving >= 0) sum -= mask[at(line, leaving)]
      if (entering < size) sum += mask[at(line, entering)]
    }
  }
  return out
}

/** Three box passes each way: close to a Gaussian of `sigma` px. */
function blur(mask: Float64Array, size: number, sigma: number): Float64Array {
  const radius = Math.max(1, Math.round((Math.sqrt((12 * sigma * sigma) / 3 + 1) - 1) / 2))
  let out = mask
  for (let pass = 0; pass < 3; pass += 1) out = boxPass(boxPass(out, size, radius, true), size, radius, false)
  return out
}

function over(canvas: Canvas, index: number, colour: Rgba, amount: number): void {
  const at = index * 4
  const alpha = colour[3] * amount
  for (let channel = 0; channel < 3; channel += 1) {
    canvas.data[at + channel] = colour[channel] * amount + canvas.data[at + channel] * (1 - alpha)
  }
  canvas.data[at + 3] = alpha + canvas.data[at + 3] * (1 - alpha)
}

function drawGlow(canvas: Canvas, part: Part): void {
  if (!part.glow) return
  const glow = blur(coverage(canvas, part), canvas.size, (part.glow.blur / 2) * canvas.scale)
  const colour = stopColour(part.glow)
  glow.forEach((amount, index) => {
    if (amount > 0) over(canvas, index, colour, amount)
  })
}

function drawPart(canvas: Canvas, part: Part): void {
  drawGlow(canvas, part)
  const mask = coverage(canvas, part)
  mask.forEach((amount, index) => {
    if (amount === 0) return
    const x = toBox(canvas, (index % canvas.size) + 0.5)
    const y = toBoxY(canvas, Math.floor(index / canvas.size) + 0.5)
    part.paints.forEach((paint) => over(canvas, index, paintAt(paint, x, y), amount))
  })
}

/** Auto in `state` as a `size` × `size` RGBA picture, straight (not premultiplied) 8-bit colour. */
export function rasterAuto(state: MascotName, size: number): Raster {
  const canvas: Canvas = { size, scale: size / AUTO_BOX.size, data: new Float64Array(size * size * 4) }
  autoParts(state).forEach((part) => drawPart(canvas, part))
  const pixels = Buffer.alloc(size * size * 4)
  for (let index = 0; index < size * size; index += 1) {
    const alpha = canvas.data[index * 4 + 3]
    for (let channel = 0; channel < 3; channel += 1) {
      const straight = alpha > 0 ? canvas.data[index * 4 + channel] / alpha : 0
      pixels[index * 4 + channel] = Math.round(Math.min(1, straight) * 255)
    }
    pixels[index * 4 + 3] = Math.round(Math.min(1, alpha) * 255)
  }
  return { width: size, height: size, pixels }
}
