import { resolve } from "node:path";
import type { SkinError } from "../../lib/skins/format";
import { validateSkin } from "../../lib/skins/validate";
import { isControl } from "../../lib/skins/validate-common";
import { parseSkinJson, readSkinSource } from "./skin-source";

// npm run validate <dir|file.autoskin>: the same rules as Studio, each problem printed with its
// JSON path (or the package file it is about). Exit code 0 when valid, 1 when not, 2 on misuse.

export interface Io {
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
}

export const USAGE = "Usage: npm run validate <skin folder | file.autoskin>";

const LINE_MAX = 400;

/** Paths and messages can carry a hostile file's names: no escapes or line breaks reach the terminal. */
export function terminalSafe(text: string): string {
  const chars = [...text].map((char) => (isControl(char) ? "?" : char));
  return chars.length > LINE_MAX ? `${chars.slice(0, LINE_MAX).join("")}…` : chars.join("");
}

function printErrors(target: string, errors: readonly SkinError[], io: Io): number {
  for (const error of errors) io.error(`✗ ${terminalSafe(error.path)}  ${terminalSafe(error.message)}`);
  io.error(`${errors.length} ${errors.length === 1 ? "problem" : "problems"} in ${target}.`);
  return 1;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function runValidate(args: readonly string[], io: Io): Promise<number> {
  const target = args[0];
  if (!target || args.length > 1) {
    io.error(USAGE);
    return 2;
  }
  try {
    const source = await readSkinSource(resolve(target));
    if (source.errors.length > 0 || source.skinJson === null) return printErrors(target, source.errors, io);
    const parsed = parseSkinJson(source.skinJson);
    if (!parsed.ok) return printErrors(target, [parsed.error], io);
    const result = validateSkin(parsed.value, source.assets, { packageBytes: source.packageBytes });
    if (!result.ok) return printErrors(target, result.errors, io);
    io.log(`✓ ${result.skin.name} (${result.skin.slug} ${result.skin.version}) is a valid automatos-skin/v1 skin.`);
    return 0;
  } catch (error) {
    if (isMissing(error)) {
      io.error(`There's no folder or file at ${target}.`);
      return 2;
    }
    console.error(error);
    io.error(`Couldn't read ${target}. The details are above.`);
    return 1;
  }
}
