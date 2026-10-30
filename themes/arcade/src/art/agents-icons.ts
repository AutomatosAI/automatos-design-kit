import type { IconKey } from '../looks/catalogue'
import { Canvas, gridOfRows, runsOf, type Point, type Run } from './grid'

/**
 * The party's robots and the inventory's item icons, as the design draws them (drawAgent and ICONS in the mock).
 * A party robot is 16 by 16: a body in its own colour, an antenna by its place in the roster, a visor and two eyes.
 * An item icon is 12 by 12: a report, a document, an image or a post. Pure; each drawn once.
 */

export type AgentKey = 'body' | 'shade' | 'crest' | 'o' | 'v' | 'e'
export const AGENT_SIZE = 16
export const ICON_SIZE = 12
/** The four robots a roster cycles through. */
export const AGENT_LOOKS = 4

const ANTENNAE: readonly (readonly Point[])[] = [
  [[8, 2], [8, 3], [8, 4]],
  [[5, 3], [5, 4], [10, 3], [10, 4]],
  [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [4, 4], [11, 4]],
  [[7, 2], [8, 2], [6, 3], [9, 3], [7, 4], [8, 4]],
]

function drawAgent(index: number): readonly Run<AgentKey>[] {
  const draw = new Canvas<AgentKey>(AGENT_SIZE)
  const body: Point[] = []
  for (let y = 5; y < 13; y += 1) for (let x = 3; x < 13; x += 1) body.push([x, y])
  const antenna = ANTENNAE[index % AGENT_LOOKS]
  draw.blob([...body, ...antenna], 'body', 'o')
  antenna.forEach(([x, y]) => draw.set(x, y, 'crest'))
  draw.fill(3, 12, 10, 1, 'shade')
  draw.fill(5, 7, 6, 3, 'v')
  draw.set(6, 8, 'e')
  draw.set(9, 8, 'e')
  draw.fill(5, 14, 6, 1, 'shade')
  draw.set(4, 14, 'o')
  draw.set(11, 14, 'o')
  draw.fill(4, 15, 8, 1, 'o')
  return runsOf(draw.grid())
}

export const AGENT_ART: readonly (readonly Run<AgentKey>[])[] = Array.from({ length: AGENT_LOOKS }, (_, index) => drawAgent(index))

export type ItemKind = 'report' | 'document' | 'image' | 'post'

const ICON_ROWS: Readonly<Record<ItemKind, readonly string[]>> = {
  report: ['............', '.OOOOOOOOO..', '.OPPPPPPPOp.', '.OPLLLLPPOp.', '.OPPPPPPPOp.', '.OPPPPPYPOp.', '.OPPKPPYPOp.', '.OPRKPPYPOp.', '.OPRKPPYPOp.', '.OPPPPPPPOp.', '.OOOOOOOOOp.', '..pppppppppp'],
  document: ['.OOOOOOO....', '.OPPPPPOO...', '.OPPPPPOpO..', '.OPLLLPOOOO.', '.OPPPPPPPPO.', '.OPLLLLLLPO.', '.OPPPPPPPPO.', '.OPLLLLLPPO.', '.OPPPPPPPPO.', '.OPLLLLLLPO.', '.OOOOOOOOOO.', '............'],
  image: ['............', 'OOOOOOOOOOOO', 'OKKKKKKKKKKO', 'OKKKKKKKYYKO', 'OKKKKKKKYYKO', 'OKKKKGKKKKKO', 'OKKGGGKKKKKO', 'OKGGGGGKGKKO', 'OGGGGGGGGGGO', 'OGGGGGGGGGGO', 'OOOOOOOOOOOO', '............'],
  post: ['............', '.OOOOOOOOOO.', 'OPPPPPPPPPPO', 'OPLLLLLLLPPO', 'OPPPPPPPPPPO', 'OPLLLLLPPRPO', 'OPPPPPPPPPPO', '.OOPPOOOOOO.', '..OPO.......', '..OO........', '............', '............'],
}

const ICON_CHARS: Readonly<Record<string, IconKey>> = {
  O: 'o', P: 'paper', p: 'shade', L: 'line', K: 'blue', R: 'red', Y: 'gold', G: 'green',
}

export const ICON_ART: Readonly<Record<ItemKind, readonly Run<IconKey>[]>> = {
  report: runsOf(gridOfRows(ICON_ROWS.report, ICON_CHARS)),
  document: runsOf(gridOfRows(ICON_ROWS.document, ICON_CHARS)),
  image: runsOf(gridOfRows(ICON_ROWS.image, ICON_CHARS)),
  post: runsOf(gridOfRows(ICON_ROWS.post, ICON_CHARS)),
}
