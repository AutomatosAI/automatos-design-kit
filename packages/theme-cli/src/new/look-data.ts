/**
 * Play's look data for the full template (PRD-261 B-03f): looks/schema.json, the presets and boot/prepaint.json, as
 * Play's own build writes them. The kit's scripts/compile-looks.mjs builds them from Play's catalogue and presets
 * (themes/play/src/lib/looks), so `new` runs it, with this Node, into a folder of its own, and reads back what it
 * wrote. full.ts then renames them with the rest: the new theme ships them as its own data, written once, which
 * `check design` holds to its catalogue's colours from then on.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFolder, type FolderFile } from './placeholders.ts'

/** The kit's look compiler, from the kit's root. */
export const COMPILE_LOOKS = 'scripts/compile-looks.mjs'
const TEMP_PREFIX = 'automatos-new-looks-'
/** A cold runner's Node, loading Play's catalogue and the look kit. */
const COMPILE_TIMEOUT_MS = 60_000

/** The files compile-looks writes for Play, by their package paths (`looks/...`, `boot/prepaint.json`). */
export function playLookFiles(kitRoot: string): FolderFile[] {
  const dir = mkdtempSync(join(tmpdir(), TEMP_PREFIX))
  try {
    const run = spawnSync(process.execPath, [join(kitRoot, COMPILE_LOOKS), dir], { encoding: 'utf8', timeout: COMPILE_TIMEOUT_MS })
    if (run.status !== 0) {
      throw new Error(`${COMPILE_LOOKS} could not write Play's look data (exit ${String(run.status)}): ${run.stderr.trim()}`)
    }
    return readFolder(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
