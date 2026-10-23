/** A seeded theme file with three refused patterns, one per line, and the codes the review gives them. */
export const SEEDED_TEXT = [
  "import { cn } from '@/x'",
  "const data = await fetch('/api/data')",
  "const call = globalThis['fe'+'tch']",
].join('\n')

/** The review's codes for SEEDED_TEXT, in line order. */
export const SEEDED_CODES: readonly string[] = ['JS_ALIAS_IMPORT', 'JS_FETCH', 'JS_COMPUTED_GLOBAL']

export const SEEDED_FILE = 'seeded.ts'
