#!/usr/bin/env node
// Auto's clips and stills for a theme's package (PRD-261 A-16b). They are not committed to this public repo
// until the image rights are confirmed (PRD-001, open question 1): core already ships them, so the build
// fetches each one from core at the commit the theme's mascot.lock.json pins, checks its sha256 and
// size, and writes it to assets/mascot/. A file already there with the right hash is kept. Any mismatch
// stops the build. Usage: node scripts/fetch-mascot.mjs <theme folder>
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAW_ROOT = 'https://raw.githubusercontent.com'
const NAME = /^[a-z0-9][a-z0-9._-]{0,127}\.(?:png|webm|mp4)$/
const SHA = /^[0-9a-f]{64}$/
const REF = /^[0-9a-f]{40}$/

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function readLock(themeDir) {
  const lock = JSON.parse(readFileSync(join(themeDir, 'mascot.lock.json'), 'utf8'))
  if (!REF.test(lock.ref)) throw new Error(`mascot.lock.json: ref must be a full commit SHA, got ${lock.ref}`)
  for (const [name, entry] of Object.entries(lock.files)) {
    if (!NAME.test(name) || !SHA.test(entry.sha256)) throw new Error(`mascot.lock.json: bad entry ${name}`)
  }
  return lock
}

function matches(bytes, entry) {
  return bytes.length === entry.bytes && sha256(bytes) === entry.sha256
}

async function fetchOne(lock, name, entry) {
  const url = `${RAW_ROOT}/${lock.repository}/${lock.ref}/${lock.path}/${name}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${name}: ${url} answered ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!matches(bytes, entry)) throw new Error(`${name}: the file at ${url} does not match its sha256 and size`)
  return bytes
}

async function main() {
  const themeDir = resolve(process.argv[2] ?? '.')
  const lock = readLock(themeDir)
  const outDir = join(themeDir, 'assets', 'mascot')
  mkdirSync(outDir, { recursive: true })
  let fetched = 0
  for (const [name, entry] of Object.entries(lock.files)) {
    const target = join(outDir, name)
    if (existsSync(target) && matches(readFileSync(target), entry)) continue
    writeFileSync(target, await fetchOne(lock, name, entry))
    fetched += 1
  }
  console.log(`fetch-mascot: ${Object.keys(lock.files).length} files ready in ${outDir} (${fetched} fetched)`)
}

main().catch((error) => {
  console.error(`fetch-mascot: ${error.message}`)
  process.exit(1)
})
