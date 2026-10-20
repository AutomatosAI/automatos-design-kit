#!/usr/bin/env node
/**
 * The `automatos-theme` executable. Node runs this TypeScript file directly (type stripping,
 * Node 22.18 or later); the work is in cli-main.ts.
 */
import { run } from './cli-main.ts'

process.exitCode = await run(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
})
