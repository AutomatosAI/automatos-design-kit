// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guards the proxy rule: only app/api/* knows the backend, and the page holds no secrets.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CODE = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"]);
const TEXT = new Set([...CODE, ".json", ".css", ".yml", ".yaml", ".example", ".txt"]);
// Prose that states the rule (CLAUDE.md, the PRD, the skill, the Ralph kit) is not code.
const SKIP = new Set(["node_modules", ".next", ".git", "coverage", "docs", "skills", "scripts", "public/auto"]);
const ADMIN_KEY = ["ORCHESTRATOR", "API", "KEY"].join("_");

function filesUnder(dir: string, extensions: Set<string>): string[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((name) => {
    const path = join(dir, name);
    if (SKIP.has(path) || SKIP.has(name)) return [];
    if (statSync(join(ROOT, path)).isDirectory()) return filesUnder(path, extensions);
    const extension = extname(name) || name;
    return extensions.has(extension) ? [path] : [];
  });
}

describe("server boundary", () => {
  it("keeps lib/server out of pages, components, hooks and lib/client", () => {
    const browserSide = [
      ...filesUnder("app", CODE).filter((file) => !file.startsWith(join("app", "api"))),
      ...filesUnder("components", CODE),
      ...filesUnder("hooks", CODE),
      ...filesUnder(join("lib", "client"), CODE),
    ];
    expect(browserSide.length).toBeGreaterThan(0);
    for (const file of browserSide) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect({ file, importsServer: /from\s+["'][^"']*lib\/server/.test(source) }).toEqual({
        file,
        importsServer: false,
      });
    }
  });

  it("never mentions the install's admin key in code or config", () => {
    const files = filesUnder(".", TEXT);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect({ file, mentions: source.includes(ADMIN_KEY) }).toEqual({ file, mentions: false });
    }
  });
});
