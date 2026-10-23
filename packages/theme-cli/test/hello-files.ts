/**
 * Reading a theme folder as core's build.py reads the hello package: the one walk the corpus test
 * (core-corpus.test.ts) and the check tests (check-support.ts) share.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Every file of a folder by its relative path, dotfiles left out (build.py `_folder_members`). */
export function folderFiles(root: string, prefix = ''): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  readdirSync(join(root, prefix)).filter((name) => !name.startsWith('.')).forEach((name) => {
    const path = prefix ? `${prefix}/${name}` : name
    if (statSync(join(root, path)).isDirectory()) folderFiles(root, path).forEach((data, inner) => files.set(inner, data))
    else files.set(path, new Uint8Array(readFileSync(join(root, path))))
  })
  return files
}
