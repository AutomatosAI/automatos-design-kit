/**
 * A package's looks: `looks/schema.json` checked, then every preset against it.
 *
 * A port of `look_file_errors`, `preset_paths` and `preset_ids` in core's
 * orchestrator/services/themes/look_schema.py, over the vendored TypeScript validators
 * (core/look-schema.ts). PA-14: every theme ships a look editor, so a look schema and at least one
 * preset, and a preset's id is its file name.
 */
import { echo, themeError, type ThemeError } from './core/css-value.ts'
import { validateLook, validateLookSchema, type LookSchema } from './core/look-schema.ts'
import { parseJson } from './json.ts'

export const SCHEMA_PATH = 'looks/schema.json'
export const PRESETS_DIR = 'looks/presets/'
const PRESET_SUFFIX = '.look.json'

/** The preset files among a package's paths, in order. */
export function presetPaths(paths: Iterable<string>): string[] {
  return Array.from(paths).filter((path) => path.startsWith(PRESETS_DIR) && path.endsWith(PRESET_SUFFIX)).sort()
}

/** The presets' ids, by file name (a preset's id equals its file name). */
export function presetIds(paths: Iterable<string>): Set<string> {
  return new Set(presetPaths(paths).map((path) => path.slice(PRESETS_DIR.length, -PRESET_SUFFIX.length)))
}

function presetErrors(schema: LookSchema, path: string, raw: Uint8Array): ThemeError[] {
  const { data, error } = parseJson(raw, path)
  if (error !== null) return [error]
  const errors = validateLook(schema, data).map((item) => themeError(item.code, `${path}#${item.path}`, `${path}: ${item.message}`))
  if (errors.length > 0) return errors
  // validateLook passed, so `data` is a JSON object.
  const stem = path.slice(PRESETS_DIR.length, -PRESET_SUFFIX.length)
  if ((data as { readonly id?: unknown }).id === stem) return []
  return [themeError('PRESET_ID_MISMATCH', path, `${path}: its "id" must be "${echo(stem)}", the file's name.`)]
}

/** Every refusal of the package's look schema and presets. */
export function lookFileErrors(files: ReadonlyMap<string, Uint8Array>): ThemeError[] {
  const raw = files.get(SCHEMA_PATH)
  if (raw === undefined) {
    return [themeError('MISSING_FILE', SCHEMA_PATH, `A theme must ship ${SCHEMA_PATH}: every theme has a look editor.`)]
  }
  const { data, error } = parseJson(raw, SCHEMA_PATH)
  if (error !== null) return [error]
  const { schema, errors } = validateLookSchema(data)
  if (schema === null) return errors.map((item) => themeError(item.code, `${SCHEMA_PATH}#${item.path}`, item.message))
  const presets = presetPaths(files.keys())
  if (presets.length === 0) {
    return [themeError('NO_PRESET', PRESETS_DIR, `A theme must ship at least one preset in ${PRESETS_DIR}.`)]
  }
  return presets.flatMap((path) => presetErrors(schema, path, files.get(path) as Uint8Array))
}
