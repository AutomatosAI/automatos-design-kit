// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { READING_TOOLS, SEARCHING_TOOLS, toolActivity, WORKING_TOOLS } from "@/lib/mascot/tools";

describe("toolActivity", () => {
  it("matches every listed name exactly", () => {
    for (const name of SEARCHING_TOOLS) expect(toolActivity(name)).toBe("searching");
    for (const name of READING_TOOLS) expect(toolActivity(name)).toBe("reading");
    for (const name of WORKING_TOOLS) expect(toolActivity(name)).toBe("working");
  });

  it("falls back to the patterns for tools the lists don't know", () => {
    expect(toolActivity("platform_web_screenshot")).toBe("searching");
    expect(toolActivity("platform_browse_marketplace_themes")).toBe("searching");
    expect(toolActivity("platform_summarise_document")).toBe("reading");
    expect(toolActivity("platform_graph_neighbors")).toBe("reading");
    expect(toolActivity("recall_memories")).toBe("reading");
  });

  it("calls everything else working, writes that match a reading pattern included", () => {
    expect(toolActivity("generate_document")).toBe("working");
    expect(toolActivity("platform_store_memory")).toBe("working");
    expect(toolActivity("platform_query_data")).toBe("working");
    expect(toolActivity("query_database")).toBe("working");
    expect(toolActivity("")).toBe("working");
  });
});

// The backend adds tools, so the names live in one file (lib/mascot/tools.ts).
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CODE = new Set([".ts", ".tsx"]);
const TOOLS_FILE = join("lib", "mascot", "tools.ts");

function codeUnder(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return codeUnder(path);
    return CODE.has(extname(name)) ? [path] : [];
  });
}

describe("tool-name lists", () => {
  it("live only in lib/mascot/tools.ts", () => {
    const names = [...SEARCHING_TOOLS, ...READING_TOOLS, ...WORKING_TOOLS];
    const files = ["app", "components", "hooks", "lib"].flatMap(codeUnder).filter((file) => file !== TOOLS_FILE);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), "utf8");
      const found = names.filter((name) => source.includes(`"${name}"`));
      expect({ file, found }).toEqual({ file, found: [] });
    }
  });
});
