// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ALLOWED_TOKENS,
  CONTRAST_PAIRS,
  DERIVED_ALIASES,
  FONT_MAX_BYTES,
  MASCOT_FORMATS,
  MASCOT_LIGHTS,
  MASCOT_MAX_BYTES,
  MASCOT_SHELLS,
  MASCOT_STATES,
  PACKAGE_MAX_BYTES,
  PREVIEW_PATH,
  SHIPPED_FONTS,
  SKIN_SCHEMA,
} from "@/lib/skins/format";
import { DEFAULT_STUDIO_URL, IMPORT_SKIN_ROUTE, NO_SKINS_MESSAGE, SUBMIT_SKIN_ROUTE } from "@/lib/skins/sharing";
import { validateSkin } from "@/lib/skins/validate";

import { asset } from "./helpers";

// The build-automatos-skin skill and the README (PRD-004 K-009) describe the format to people
// and assistants: keep them in step with lib/skins/format.ts. Change a token, a pair or a limit
// there and these fail until the guides say the same.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILL_DIR = "skills/build-automatos-skin";
const REFERENCES = ["tokens.md", "contrast.md", "fonts.md", "mascot.md", "packaging.md"] as const;
const KB = 1024;
const MB = 1024 * KB;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function reference(name: (typeof REFERENCES)[number]): string {
  return read(`${SKILL_DIR}/references/${name}`);
}

function code(text: string): string {
  return `\`${text}\``;
}

function firstJsonBlock(markdown: string): unknown {
  const match = /```json\n([\s\S]*?)```/.exec(markdown);
  if (!match?.[1]) throw new Error("no ```json block");
  return JSON.parse(match[1]) as unknown;
}

describe("skills/build-automatos-skin/SKILL.md", () => {
  const skill = read(`${SKILL_DIR}/SKILL.md`);

  it("has the frontmatter an assistant loads it by", () => {
    const frontmatter = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(skill);
    expect(frontmatter?.[1]).toBe("build-automatos-skin");
    expect((frontmatter?.[2] ?? "").length).toBeGreaterThan(80);
  });

  it("names every reference, and each one exists", () => {
    for (const name of REFERENCES) {
      expect(skill).toContain(`references/${name}`);
      expect({ name, exists: existsSync(join(ROOT, SKILL_DIR, "references", name)) }).toEqual({ name, exists: true });
    }
  });

  it("gives the workflow: validate until clean, pack, and never code in a skin", () => {
    for (const text of ["npm run validate", "npm run pack", "Never write CSS, JavaScript", `${ALLOWED_TOKENS.length} of them`]) {
      expect(skill).toContain(text);
    }
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(Object.keys(pkg.scripts)).toEqual(expect.arrayContaining(["validate", "pack", "dev"]));
  });
});

describe("the skill's references", () => {
  it("tokens.md names every allowed token and every derived alias", () => {
    const doc = reference("tokens.md");
    expect(doc).toContain(`${ALLOWED_TOKENS.length} allowed tokens`);
    for (const name of [...ALLOWED_TOKENS, ...DERIVED_ALIASES]) expect({ name, named: doc.includes(code(name)) }).toEqual({ name, named: true });
  });

  it("contrast.md lists exactly the validator's pairs and floors: the core's 14 (S-001)", () => {
    expect(CONTRAST_PAIRS).toHaveLength(14);
    expect(ALLOWED_TOKENS).toHaveLength(47);
    const doc = reference("contrast.md");
    const rows = Array.from(doc.matchAll(/^\| `([a-z0-9-]+)` \| `([a-z0-9-]+)` \| ([\d.]+):1 \|$/gm), (row) => ({
      text: row[1],
      on: row[2],
      min: Number(row[3]),
    }));
    expect(rows).toEqual(CONTRAST_PAIRS.map((pair) => ({ text: pair.text, on: pair.on, min: pair.min })));
  });

  it("fonts.md names Studio's font keys, the FontFace loading and the size cap", () => {
    const doc = reference("fonts.md");
    for (const font of SHIPPED_FONTS) expect(doc).toContain(code(font));
    expect(doc).toContain(`${FONT_MAX_BYTES / KB} KB`);
    expect(doc).toContain("FontFace");
  });

  it("mascot.md has every state, format, shell and the cap", () => {
    const doc = reference("mascot.md");
    for (const state of MASCOT_STATES) expect(doc).toMatch(new RegExp(`^\\| \`${state}\` \\|`, "m"));
    for (const format of MASCOT_FORMATS) expect(doc).toContain(`<state>.${format}`);
    for (const shell of MASCOT_SHELLS) expect(doc).toContain(code(shell));
    for (const light of MASCOT_LIGHTS) expect(doc).toContain(code(light));
    expect(doc).toContain(`${MASCOT_STATES.length * MASCOT_FORMATS.length} files`);
    expect(doc).toContain(`${MASCOT_MAX_BYTES / MB} MB`);
  });

  it("packaging.md covers validate, pack, load and submit", () => {
    const doc = reference("packaging.md");
    for (const text of [
      "npm run validate",
      "npm run pack",
      "/api/skins/import",
      "/api/marketplace/skins",
      IMPORT_SKIN_ROUTE,
      SUBMIT_SKIN_ROUTE,
      NO_SKINS_MESSAGE,
      DEFAULT_STUDIO_URL,
      `${PACKAGE_MAX_BYTES / MB} MB`,
    ]) {
      expect(doc).toContain(text);
    }
  });
});

describe("README.md for designers and developers", () => {
  const readme = read("README.md");

  it("has the first skin, the skill, the CLI, Studio, the Marketplace and what was retired", () => {
    for (const heading of [
      "## Your first skin in 15 minutes",
      "## Make a skin with Claude Code or Codex",
      "## The command line",
      "## How Studio loads a skin",
      "## The Marketplace",
      "## What was retired",
    ]) {
      expect(readme).toContain(heading);
    }
    for (const text of [SKILL_DIR, "npm run validate", "npm run pack", "PRD-259", "378e98f", `${CONTRAST_PAIRS.length} pairs`]) {
      expect(readme).toContain(text);
    }
  });

  it("its example skin.json passes the validator", () => {
    const example = firstJsonBlock(readme);
    const result = validateSkin(example, [asset(PREVIEW_PATH, "png")]);
    expect(result.errors).toEqual([]);
    expect(result.ok && result.skin.schema).toBe(SKIN_SCHEMA);
  });
});
