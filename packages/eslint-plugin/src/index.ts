/**
 * @automatos/eslint-plugin: the JS rules the Marketplace review runs on a theme's source/
 * (@automatos/theme-rules), as ESLint rules, so a theme's author sees a refused pattern in `npm run lint`
 * before the review does.
 *
 * One rule per code the review reports (codes.ts), named by the code: `@automatos/JS_FETCH` and the rest.
 * The recommended config lints every script under the theme's `src/` with every rule, an error code as an
 * error and a warning code as a warning, through a parser that parses nothing (text-parser.ts): the rules
 * read the text, as the review does.
 *
 *   // eslint.config.js, in the theme's folder
 *   import automatos from '@automatos/eslint-plugin'
 *   export default [automatos.configs.recommended]
 */
import type { ESLint, Linter, Rule } from 'eslint'
import { CODES, levelOf } from './codes.ts'
import { PACKAGE } from './package-meta.ts'
import { codeRule, THEME_SOURCE_DIR } from './rules.ts'
import { textParser } from './text-parser.ts'

export { CHECK_CODES, CODES, levelOf, severityOf } from './codes.ts'
export type { Level } from './codes.ts'
export { MESSAGE_ID, SETTINGS_KEY, THEME_SOURCE_DIR } from './rules.ts'
export { textParser } from './text-parser.ts'

/** The rules' prefix in a config, after the package's scope: `@automatos/JS_FETCH`. */
export const NAMESPACE = '@automatos'
/** The script files the review reads under source/ (theme-rules' SCRIPT_FILE), as glob extensions. */
export const SCRIPT_EXTENSIONS: readonly string[] = Object.freeze(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'])

export interface AutomatosPlugin extends ESLint.Plugin {
  readonly meta: { readonly name: string; readonly version: string; readonly namespace: string }
  readonly rules: Readonly<Record<string, Rule.RuleModule>>
  readonly configs: { readonly recommended: Linter.Config }
}

const rules: Readonly<Record<string, Rule.RuleModule>> = Object.freeze(
  Object.fromEntries(CODES.map((code) => [code, codeRule(code)])),
)

/** Every rule on every script under src/, at its code's level, with the text parser. */
function recommendedConfig(self: AutomatosPlugin): Linter.Config {
  return {
    name: `${NAMESPACE}/recommended`,
    files: [`${THEME_SOURCE_DIR}/**/*.{${SCRIPT_EXTENSIONS.join(',')}}`],
    languageOptions: { parser: textParser, sourceType: 'module' },
    plugins: { [NAMESPACE]: self },
    rules: Object.fromEntries(CODES.map((code) => [`${NAMESPACE}/${code}`, levelOf(code)])),
  }
}

// The config names the plugin itself, so it is built when read: one plugin object, never redefined.
const plugin: AutomatosPlugin = {
  meta: { name: PACKAGE.name, version: PACKAGE.version, namespace: NAMESPACE },
  rules,
  configs: {
    get recommended(): Linter.Config {
      return recommendedConfig(plugin)
    },
  },
}

export default plugin
