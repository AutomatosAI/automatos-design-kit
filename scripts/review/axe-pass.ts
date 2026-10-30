/**
 * The review's axe pass (PRD-261 B-02j), apart from the command that runs it (axe.ts), so the tests run it with
 * shots of their own. The package read as the review reads it (review.ts `readPackage`), laid out for the harness in
 * a work folder of its own (axe-layout.ts), drawn by `automatos-theme shots` into SHOTS_DIR there, and what axe found
 * read back (axe-report.ts). Nothing here throws for a package that can't be drawn: the run says why instead.
 */
import { join } from 'node:path'
import { layOutPackage } from './axe-layout.ts'
import { readScanSets, summarize, type AxeRun } from './axe-report.ts'
import { readPackage } from './review.ts'

/** The shots' folder in the pass's work folder. */
export const SHOTS_DIR = 'shots'

/** `automatos-theme shots <themeDir> --out <outDir>`; its exit code. */
export type Shots = (themeDir: string, outDir: string) => number | Promise<number>

/** The pass over one package's bytes, in `workDir`, with `shots` drawing it. */
export async function axePass(zip: Buffer, workDir: string, shots: Shots): Promise<AxeRun> {
  const read = readPackage(zip)
  if (read.files === null) return { status: 'not_run', why: `the package was not read (${read.check.detail})` }
  const layout = layOutPackage(read.files, workDir)
  if (!layout.ok) return { status: 'not_run', why: layout.why }
  const outDir = join(workDir, SHOTS_DIR)
  const shotsExit = await shots(layout.themeDir, outDir)
  return { status: 'ran', shotsExit, summary: summarize(readScanSets(outDir)) }
}
