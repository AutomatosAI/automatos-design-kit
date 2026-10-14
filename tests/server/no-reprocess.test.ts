// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// P-009: POST /api/documents/{id}/reprocess starts processing again, so Play never calls
// it (knowledge.md, "Processing status"). Comments may name it, code may not. The one
// exception is the chat tool name Auto can call, which the mascot reads as work: it is a
// word in the stream, not a route Play calls.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CODE = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"]);
const SCANNED = ["app", "lib", "components", "hooks"];
const ALLOWED_WORDS = ["platform_reprocess_document"];

function codeFiles(dir: string): string[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return codeFiles(path);
    return CODE.has(extname(name)) ? [path] : [];
  });
}

/** The source with block and line comments removed ("http://" in a string stays). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function mentionsReprocess(source: string): boolean {
  const code = ALLOWED_WORDS.reduce((text, word) => text.split(word).join(""), withoutComments(source));
  return /reprocess/i.test(code);
}

describe("no reprocess", () => {
  it("reads comments as comments", () => {
    expect(mentionsReprocess("// never POST /reprocess\nconst a = 1;")).toBe(false);
    expect(mentionsReprocess("/** not /reprocess */ const a = 1;")).toBe(false);
    expect(mentionsReprocess('fetch(`/api/documents/${id}/reprocess`, { method: "POST" });')).toBe(true);
    expect(mentionsReprocess('const url = "http://x/reprocess";')).toBe(true);
  });

  it("finds no reprocess call outside comments in app/, lib/, components/ or hooks/", () => {
    const files = SCANNED.flatMap(codeFiles);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((file) => mentionsReprocess(readFileSync(join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
