import type { SpriteKey } from '../looks/catalogue'
import { box, Canvas, type Grid, type Point } from './grid'

/**
 * Auto as Arcade draws him: an original round robot 32 by 32 pixels (a bronze shell, a dark visor, mint eyes and a
 * single crest), drawn from code as the design's mock draws him ("Automatos Arcade.dc.html", drawAuto), one pose at
 * a time. A pose moves him (dx, dy), sets his arms and eyes, and adds an effect (a thought bubble, a "z", a "?",
 * sparkles, a drop, an orbiting light). Pure: the same pose always draws the same grid.
 */

export const AUTO_SIZE = 32

export type Arms = 'down' | 'up' | 'wave1' | 'wave2' | 'tap1' | 'tap2' | 'out'
export type Eyes =
  | 'open' | 'blink' | 'happy' | 'wide' | 'up' | 'left' | 'right' | 'small' | 'narrow' | 'line' | 'page0' | 'page1' | 'page2'
export type Effect =
  | 'dots1' | 'dots2' | 'dots3' | 'z1' | 'z2' | 'z3' | 'q0' | 'q1' | 'sp1' | 'sp2' | 'spark' | 'drop' | 'o0' | 'o1' | 'o2' | 'o3'

export interface Pose {
  readonly dx?: number
  readonly dy?: number
  readonly arms?: Arms
  readonly eyes?: Eyes
  readonly fx?: Effect
}

type Draw = Canvas<SpriteKey>
type BoxSpec = readonly [number, number, number, number]

const ARMS: Readonly<Record<Arms, readonly BoxSpec[]>> = {
  down: [[4, 19, 2, 4], [26, 19, 2, 4]],
  up: [[4, 9, 2, 5], [26, 9, 2, 5]],
  wave1: [[4, 19, 2, 4], [26, 9, 2, 5]],
  wave2: [[4, 19, 2, 4], [27, 7, 2, 5]],
  tap1: [[5, 22, 3, 2], [24, 20, 3, 2]],
  tap2: [[5, 20, 3, 2], [24, 22, 3, 2]],
  out: [[1, 17, 5, 2], [26, 17, 5, 2]],
}

const CREST: readonly Point[] = [
  [17, 3], [16, 4], [17, 4], [18, 4], [15, 5], [16, 5], [17, 5], [18, 5], [15, 6], [16, 6], [17, 6], [15, 7], [16, 7], [17, 7], [16, 8],
]

function shadow(draw: Draw, dy: number): void {
  const spread = Math.max(3, 7 + Math.min(0, dy))
  for (let x = 16 - spread; x < 16 + spread; x += 1) draw.set(x, 30, 'g')
  for (let x = 18 - spread; x < 14 + spread; x += 1) draw.set(x, 31, 'g')
}

function arms(draw: Draw, pose: Arms, dx: number, dy: number): void {
  ARMS[pose].forEach(([x, y, width, height]) => draw.blob(box(x + dx, y + dy, width, height), 's', 'o'))
}

function crest(draw: Draw, dx: number, dy: number): void {
  const points = CREST.map(([x, y]): Point => [x + dx, y + dy])
  draw.blob(points, 'c', 'o')
  points.forEach(([x, y]) => {
    if (x - dx >= 17 && y - dy >= 5) draw.set(x, y, 'c2')
  })
}

function shell(draw: Draw, cx: number, cy: number): void {
  for (let y = 0; y < AUTO_SIZE; y += 1) {
    for (let x = 0; x < AUTO_SIZE; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (distance > 10) continue
      if (distance > 8.9) {
        draw.set(x, y, 'o')
        continue
      }
      const shine = Math.hypot(x + 0.5 - (cx - 4), y + 0.5 - (cy - 5))
      draw.set(x, y, shine < 2.6 ? 'h' : x + 0.5 - cx + (y + 0.5 - cy) > 8 ? 'd' : 's')
    }
  }
}

function visor(draw: Draw, cx: number, cy: number): void {
  for (let y = cy - 5; y <= cy + 2; y += 1) {
    for (let x = cx - 7; x <= cx + 6; x += 1) {
      const corner = (y === cy - 5 || y === cy + 2) && (x === cx - 7 || x === cx + 6)
      if (!corner) draw.set(x, y, 'v')
    }
  }
  draw.set(cx - 6, cy - 4, 'v2')
  draw.set(cx - 5, cy - 4, 'v2')
  draw.set(cx - 6, cy - 3, 'v2')
}

function page(draw: Draw, cx: number, cy: number, offset: number): void {
  draw.fill(cx - 5, cy - 4, 10, 6, 'w')
  ;[0, 2, 4].forEach((row) => draw.fill(cx - 4, cy - 4 + ((row + offset) % 6), row === 2 ? 5 : 8, 1, 'v2'))
}

function eyes(draw: Draw, kind: Eyes, cx: number, cy: number): void {
  const [l, r, t] = [cx - 4, cx + 2, cy - 3]
  const pair = (x1: number, x2: number, y: number, width: number, height: number, key: SpriteKey = 'e') => {
    draw.fill(x1, y, width, height, key)
    draw.fill(x2, y, width, height, key)
  }
  if (kind === 'open') pair(l, r, t, 2, 3)
  else if (kind === 'blink') pair(l, r, t + 2, 2, 1)
  else if (kind === 'happy') {
    ;([[0, 1], [1, 0], [2, 0], [3, 1]] as const).forEach(([a, b]) => {
      draw.set(l - 1 + a, t + b, 'e')
      draw.set(r - 1 + a, t + b, 'e')
    })
  } else if (kind === 'wide') {
    pair(l - 1, r, t - 1, 3, 4)
    draw.set(l - 1, t - 1, 'w')
    draw.set(r, t - 1, 'w')
  } else if (kind === 'up') pair(l, r, t - 1, 2, 2)
  else if (kind === 'left') pair(l - 1, r - 1, t, 2, 3)
  else if (kind === 'right') pair(l + 1, r + 1, t, 2, 3)
  else if (kind === 'small') pair(l + 1, r, t + 1, 1, 2)
  else if (kind === 'narrow') pair(l - 1, r, t + 1, 3, 1)
  else if (kind === 'line') pair(l - 1, r, t + 2, 3, 1, 'e2')
  else page(draw, cx, cy, Number(kind.slice(4)))
}

const Z_AT: Readonly<Record<string, Point>> = { z1: [23, 9], z2: [25, 6], z3: [27, 2] }
const Z_SHAPE: readonly Point[] = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]]
const QUESTION = ['.QQ.', 'Q..Q', '...Q', '..Q.', '....', '..Q.']
const SPARKLES: Readonly<Record<string, readonly Point[]>> = { sp1: [[4, 5], [27, 3], [3, 25]], sp2: [[6, 2], [28, 11], [28, 25]] }
const ORBIT: readonly Point[] = [[15, 1], [28, 17], [15, 27], [2, 17]]

function question(draw: Draw, left: number): void {
  const points = QUESTION.flatMap((row, j) => [...row].flatMap((char, i): Point[] => (char === 'Q' ? [[left + i, 1 + j]] : [])))
  draw.blob(points, 'q', 'o')
}

function effect(draw: Draw, fx: Effect, dx: number): void {
  if (fx.startsWith('dots')) {
    draw.blob(box(22, 1, 9, 5), 'w', 'o')
    for (let i = 0; i < Number(fx.slice(4)); i += 1) draw.set(24 + i * 2, 3, 'o')
    draw.set(21, 7, 'w')
  } else if (fx in Z_AT) {
    const [zx, zy] = Z_AT[fx]
    Z_SHAPE.forEach(([a, b]) => draw.set(zx + a, zy + b, 'w'))
  } else if (fx === 'q0' || fx === 'q1') question(draw, fx === 'q0' ? 24 : 25)
  else if (fx === 'sp1' || fx === 'sp2') {
    SPARKLES[fx].forEach(([x, y]) => ([[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const).forEach(([a, b]) => draw.set(x + a, y + b, 'k')))
  } else if (fx === 'spark') {
    draw.set(29, 19, 'k')
    draw.set(30, 18, 'k')
    draw.set(28, 18, 'k')
  } else if (fx === 'drop') draw.blob([[25 + dx, 7], [24 + dx, 8], [25 + dx, 8], [24 + dx, 9], [25 + dx, 9]], 'b', 'o')
  else orbit(draw, Number(fx.slice(1)))
}

function orbit(draw: Draw, step: number): void {
  const [x, y] = ORBIT[step]
  const [px, py] = ORBIT[(step + 3) % ORBIT.length]
  draw.fill(px, py, 2, 2, 'e2')
  draw.fill(x, y, 2, 2, 'e')
}

/** Auto in one pose. */
export function drawAuto(pose: Pose): Grid<SpriteKey> {
  const draw = new Canvas<SpriteKey>(AUTO_SIZE)
  const { dx = 0, dy = 0 } = pose
  const [cx, cy] = [16 + dx, 18 + dy]
  shadow(draw, dy)
  arms(draw, pose.arms ?? 'down', dx, dy)
  crest(draw, dx, dy)
  shell(draw, cx, cy)
  visor(draw, cx, cy)
  eyes(draw, pose.eyes ?? 'open', cx, cy)
  if (pose.fx) effect(draw, pose.fx, dx)
  return draw.grid()
}
