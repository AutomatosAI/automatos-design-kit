/**
 * PRD-260 K2, M01, M18, M19 — the readers test/css-guards.test.ts runs over Play's source: the theme's
 * stylesheets and the custom properties they define and read, the literal colours in a stylesheet or a
 * component, the JSX elements whose className names a CSS-module class and the rules that style them, and a
 * stylesheet's declarations and forced-colours rules. Moved with the guards from core's
 * lib/__tests__/prd260-play-guards.test.ts, as they were there, but for the root they read (the theme's src/,
 * test/source-files.ts) and these: allStyledElements takes the components it reads, and resolveSpecifier
 * resolves only a relative path (Play's source imports its own files that way, test/imports.test.ts). The
 * guards' rules (which variables, tags and outlines count) stay in the test.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { SOURCE_ROOT } from '../source-files.ts'
import { cssRules, elementOf, lastCompound, namesClass, withoutComments } from './css-cascade.ts'
import { componentColours, splitForcedColours, stylesheetColours } from './css-colours.ts'
import { stringArgument } from './module-references.ts'

const SKIP_DIRS = new Set(['node_modules'])

export type Rules = ReturnType<typeof cssRules>

export interface StyledElement {
  /** file:line of the JSX element. */
  readonly where: string
  readonly tag: string
  /** The CSS module the class comes from (absolute path). */
  readonly css: string
  readonly className: string
}

export interface PlayRule {
  readonly css: string
  readonly selector: string
  /** The element the rule lands on: the JSX tag, or the selector's own element name. */
  readonly tag: string
  readonly body: string
  /** A rule of a markdown surface, where the core markdown's rules reach too. */
  readonly inMarkdown: boolean
}

export function walk(dir: string, keep: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : walk(full, keep)
    return keep(entry.name) ? [full] : []
  })
}

/** A file under src/, as a path from src/ with forward slashes. */
export function relative(file: string): string {
  return path.relative(SOURCE_ROOT, file).split(path.sep).join('/')
}

/** Every stylesheet under src/: play-theme.css, play-fonts.css and the components' CSS modules. */
export function playCssFiles(): string[] {
  return walk(SOURCE_ROOT, (name) => name.endsWith('.css'))
}

// --- (b) and (c): custom properties and literal colours --------------------------------------

/** Every custom property the stylesheet defines (`--x:`). */
export function definedProperties(css: string): string[] {
  return Array.from(withoutComments(css).matchAll(/(?<![\w-])(--[\w-]+)\s*:/g), (match) => match[1] ?? '')
}

/** Every custom property the stylesheet reads (`var(--x`). */
export function readProperties(css: string): string[] {
  return Array.from(withoutComments(css).matchAll(/var\(\s*(--[\w-]+)/g), (match) => match[1] ?? '')
}

/** Every custom property the stylesheet defines (`--x:`) or reads (`var(--x`). */
export function customProperties(css: string): string[] {
  return [...definedProperties(css), ...readProperties(css)]
}

/** The literal colours in one of Play's stylesheets or components. */
export function playColours(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8')
  return file.endsWith('.css') ? stylesheetColours(text) : componentColours(file, text)
}

// --- (d): the elements a CSS-module class styles, and the rules on them -----------------------

/** A CSS module's path: Play's source imports its own files by relative path only (test/imports.test.ts). */
function resolveSpecifier(fromFile: string, specifier: string): string {
  return path.resolve(path.dirname(fromFile), specifier)
}

/** `import styles from './x.module.css'` → styles → the module's path. */
function cssModuleBindings(file: ts.SourceFile): Map<string, string> {
  const bindings = new Map<string, string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const local = statement.importClause?.name?.text
    const specifier = stringArgument(statement.moduleSpecifier)
    if (local && specifier?.endsWith('.module.css')) bindings.set(local, resolveSpecifier(file.fileName, specifier))
  }
  return bindings
}

/** The module classes a className names: styles.x, also inside cn() or a template literal. */
function moduleClasses(value: ts.Node, bindings: Map<string, string>): Array<{ css: string; className: string }> {
  const found: Array<{ css: string; className: string }> = []
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const css = bindings.get(node.expression.text)
      if (css !== undefined) found.push({ css, className: node.name.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(value)
  return found
}

function elementClasses(file: ts.SourceFile, element: ts.JsxOpeningLikeElement, bindings: Map<string, string>): StyledElement[] {
  const attribute = element.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === 'className',
  )
  const value = attribute !== undefined && ts.isJsxAttribute(attribute) ? attribute.initializer : undefined
  if (value === undefined) return []
  const tag = ts.isIdentifier(element.tagName) ? element.tagName.text : ''
  const where = `${relative(file.fileName)}:${file.getLineAndCharacterOfPosition(element.getStart(file)).line + 1}`
  return moduleClasses(value, bindings).map((named) => ({ where, tag, ...named }))
}

/** Every JSX element in the file whose className names a CSS-module class. */
function styledElements(fileName: string, source: string): StyledElement[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const bindings = cssModuleBindings(file)
  const found: StyledElement[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) found.push(...elementClasses(file, node, bindings))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

/** The styled elements of the given components' .tsx files. */
export function allStyledElements(components: readonly string[]): StyledElement[] {
  return components
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) => styledElements(file, fs.readFileSync(file, 'utf8')))
}

export function rulesOf(css: string): Array<{ selector: string; body: string }> {
  return cssRules(fs.readFileSync(css, 'utf8')).flatMap((rule) => rule.selectors.map((selector) => ({ selector, body: rule.body })))
}

/** The rules that style the element's class: those whose last compound names it. */
export function rulesForElement(element: StyledElement): PlayRule[] {
  return rulesOf(element.css)
    .filter(({ selector }) => namesClass(lastCompound(selector), element.className))
    .map(({ selector, body }) => ({ css: element.css, selector, tag: element.tag, body, inMarkdown: false }))
}

/** Every rule of a markdown surface: any selector naming the class on the MarkdownView. */
export function rulesForMarkdown(surface: StyledElement): PlayRule[] {
  return rulesOf(surface.css)
    .filter(({ selector }) => namesClass(selector, surface.className))
    .map(({ selector, body }) => ({ css: surface.css, selector, tag: elementOf(lastCompound(selector)), body, inMarkdown: true }))
}

export function label(rule: PlayRule): string {
  return `${relative(rule.css)}: ${rule.selector}`
}

/** One line per finding: a class on several elements (edges' .title) is one rule. */
export function unique(findings: readonly string[]): string[] {
  return Array.from(new Set(findings))
}

// --- Make it yours: declarations and forced colours ------------------------------------------

/** A selector compared as written, whichever quotes its attribute value uses. */
function sameSelector(a: string, b: string): boolean {
  return a.replace(/'/g, '"') === b.replace(/'/g, '"')
}

/** The bodies of every rule whose selector list names exactly this selector, in source order. */
export function bodyOf(rules: Rules, selector: string): string {
  return rules
    .filter((rule) => rule.selectors.some((each) => sameSelector(each, selector)))
    .map((rule) => rule.body)
    .join(';')
}

/** A body's declarations, property to value; a later one wins, as in the cascade. */
export function declarations(body: string): ReadonlyMap<string, string> {
  const pairs = body.split(';').flatMap((declaration): Array<[string, string]> => {
    const colon = declaration.indexOf(':')
    if (colon < 0) return []
    return [[declaration.slice(0, colon).trim().toLowerCase(), declaration.slice(colon + 1).trim().replace(/\s+/g, ' ')]]
  })
  return new Map(pairs)
}

/** The rules inside the stylesheet's @media (forced-colors: active) blocks. */
export function forcedColoursRules(css: string): Rules {
  return splitForcedColours(css).inside.flatMap((block) => cssRules(block))
}

export function located(file: string, rule: Rules[number]): string {
  return `${relative(file)}: ${rule.selectors.join(', ')}`
}
