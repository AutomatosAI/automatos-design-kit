import type { MascotName } from '@automatos/mascot/types'

/**
 * Auto's state as Candy's state pill says it: always a glyph and a word, never colour alone ("● Listening"). A
 * screen reader hears the word alone (the glyph is decoration); the live caption, the longer "what he is doing",
 * is @automatos/mascot's captionFor. Pure.
 */

const WORDS: Readonly<Record<MascotName, string>> = {
  hello: 'Hello',
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  working: 'Working',
  searching: 'Searching',
  reading: 'Reading',
  celebrate: 'Done',
  oops: 'Oops',
  sleeping: 'Asleep',
  lost: 'Lost',
  loading: 'Loading',
}

/** The pill's glyph: a filled dot while he is on it, a ring at rest, a tick when done, a cross when it went wrong. */
const GLYPHS: Readonly<Record<MascotName, string>> = {
  hello: '●',
  idle: '○',
  listening: '●',
  thinking: '●',
  working: '●',
  searching: '●',
  reading: '●',
  celebrate: '✓',
  oops: '✕',
  sleeping: '○',
  lost: '○',
  loading: '●',
}

export function stateWord(state: MascotName): string {
  return WORDS[state]
}

export function stateGlyph(state: MascotName): string {
  return GLYPHS[state]
}
