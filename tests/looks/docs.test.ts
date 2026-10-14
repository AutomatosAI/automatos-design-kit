// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ACCENTS, ACCENT_KEYS, ERROR_COLOUR, GROUNDS, LIGHTS, SHELLS, TYPE_STYLES } from "@/lib/looks/catalogue";
import { lookToCssVars } from "@/lib/looks/css";
import { DAYLIGHT, EMBER, PRESETS } from "@/lib/looks/presets";
import { lookJson } from "@/lib/looks/transfer";
import { LOOK_SCHEMA } from "@/lib/looks/types";

// docs/LOOKS.md is the designers' reference for the format (PRD-002 L-008): keep it in step
// with the catalogue, the presets and the derived text colours it describes.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function jsonBlocks(markdown: string): readonly string[] {
  return Array.from(markdown.matchAll(/```json\n([\s\S]*?)```/g), (match) => match[1] ?? "");
}

describe("docs/LOOKS.md", () => {
  const doc = read("docs/LOOKS.md");

  it("names the schema, the fixed error colour and every catalogue entry with its values", () => {
    expect(doc).toContain(LOOK_SCHEMA);
    expect(doc).toContain(ERROR_COLOUR);
    for (const [key, ground] of Object.entries(GROUNDS)) {
      for (const value of [`\`${key}\``, ground.bg, ground.surface, ground.text, ground.text2, ground.line]) {
        expect(doc).toContain(value);
      }
    }
    for (const [key, accent] of Object.entries(ACCENTS)) {
      for (const value of [`\`${key}\``, accent.hex, accent.ink]) expect(doc).toContain(value);
    }
    for (const [key, shell] of Object.entries(SHELLS)) {
      for (const value of [`\`${key}\``, shell.hex, shell.filter]) expect(doc).toContain(value);
    }
    for (const [key, light] of Object.entries(LIGHTS)) {
      for (const value of [`\`${key}\``, light.hex]) expect(doc).toContain(value);
    }
    for (const [key, font] of Object.entries(TYPE_STYLES)) {
      expect(doc).toContain(`\`${key}\``);
      expect(doc).toContain(font.name);
    }
  });

  it("lists every preset by id", () => {
    for (const preset of PRESETS) expect(doc).toContain(`\`${preset.id}\``);
  });

  it("shows Ember exactly as Export writes it", () => {
    expect(jsonBlocks(doc)[0]).toBe(lookJson(EMBER));
  });

  it("gives the derived text colours on Paper that the code computes", () => {
    for (const accent of ACCENT_KEYS) {
      const vars = lookToCssVars({ ...DAYLIGHT, accent });
      expect(doc).toContain(`\`${vars["--accent-text"]}\``);
    }
    expect(doc).toContain(`\`${lookToCssVars(DAYLIGHT)["--error-text"]}\``);
  });
});

describe("the Looks docs are linked", () => {
  it("README mentions the Looks page, the style page and docs/LOOKS.md", () => {
    const readme = read("README.md");
    for (const text of ["/looks", "/looks/style", "docs/LOOKS.md"]) expect(readme).toContain(text);
  });

  it("the run checklist has the Looks checks", () => {
    const checklist = read("docs/RUN-CHECKLIST.md");
    expect(checklist).toContain("### Looks");
    for (const preset of PRESETS) expect(checklist).toContain(preset.name);
  });
});
