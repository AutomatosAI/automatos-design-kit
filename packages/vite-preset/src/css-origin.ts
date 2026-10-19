/**
 * The source guard inside Vite's PostCSS run. postcss-import (Vite's `@import`) reads an imported
 * stylesheet straight from disk, without a `load`, so this plugin checks what was read rather than
 * how the import was written: every file postcss-import reports as a dependency, and every node's
 * source file, must be under the theme's src/. It runs after postcss-import (Vite puts that first)
 * and before Vite rewrites url()s.
 * A node with no source file (one a plugin made from a string, such as the CSS postcss-modules
 * prepends for a `composes … from`) has no file to check; source-guard.ts scans `composes … from`.
 */
import type { Message, Plugin as PostcssPlugin, Root } from 'postcss'
import { moduleProblem, type SourceTree } from './source-tree.ts'

const PLUGIN_NAME = 'automatos-theme:css-origin'

/** The files and folders the PostCSS run reported reading. */
function reportedFiles(messages: readonly Message[]): string[] {
  return messages.flatMap((message): string[] => {
    if (message.type === 'dependency' && typeof message.file === 'string') return [message.file]
    if (message.type === 'dir-dependency' && typeof message.dir === 'string') return [message.dir]
    return []
  })
}

/** The source file of every node in the stylesheet. */
function nodeFiles(root: Root): string[] {
  const files: string[] = []
  root.walk((node) => {
    const file = node.source?.input.file
    if (file !== undefined) files.push(file)
  })
  return files
}

/** Why a stylesheet's PostCSS result may not be bundled: CSS taken in from outside src/. */
export function cssOriginProblems(root: Root, messages: readonly Message[], tree: SourceTree): string[] {
  const files = new Set([...reportedFiles(messages), ...nodeFiles(root)])
  return Array.from(files).flatMap((file) => moduleProblem(file, tree) ?? [])
}

/** The PostCSS plugin that fails the build on a stylesheet with CSS from outside the theme's src/. */
export function cssOriginGuard(tree: SourceTree): PostcssPlugin {
  return {
    postcssPlugin: PLUGIN_NAME,
    OnceExit(root, { result }) {
      const problems = cssOriginProblems(root, result.messages, tree)
      if (problems.length > 0) throw new Error(problems.join('\n'))
    },
  }
}
