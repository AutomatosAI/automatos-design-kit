// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PRESETS } from "@/lib/looks/presets";
import { validateLook } from "@/lib/looks/validate";

const VALID = {
  schema: "automatos-interface-look/v1",
  id: "c1",
  name: "My look 1",
  sub: "Saved just now",
  interface: "play",
  ground: "paper",
  accent: "rose",
  font: "bric",
  shell: "cobalt",
  light: "amber",
  glow: 0,
};

function errorsFor(input: unknown): readonly string[] {
  const result = validateLook(input);
  return result.ok ? [] : result.errors;
}

function rejects(input: unknown, fragment: string): void {
  const result = validateLook(input);
  expect(result.ok).toBe(false);
  expect(errorsFor(input).join("\n")).toContain(fragment);
}

describe("validateLook", () => {
  it("accepts every preset as it is", () => {
    for (const preset of PRESETS) {
      expect(validateLook(preset)).toEqual({ ok: true, look: preset });
    }
  });

  it("accepts a JSON round trip and returns a fresh object", () => {
    const parsed: unknown = JSON.parse(JSON.stringify(VALID));
    const result = validateLook(parsed);
    expect(result).toEqual({ ok: true, look: VALID });
    expect(result.ok && result.look).not.toBe(parsed);
  });

  it("accepts glow at both ends and trims name and sub", () => {
    expect(validateLook({ ...VALID, glow: 40 }).ok).toBe(true);
    const result = validateLook({ ...VALID, name: "  Dusk  ", sub: " " });
    expect(result.ok && result.look).toMatchObject({ name: "Dusk", sub: "" });
  });

  it("rejects anything that isn't an object", () => {
    for (const input of [null, undefined, "ember", 3, [], [VALID]]) {
      expect(errorsFor(input)).toEqual(["A Look must be a JSON object."]);
    }
  });

  it("rejects unknown fields, including raw colours and CSS", () => {
    rejects({ ...VALID, bg: "#000000" }, `"bg" isn't part of a Look`);
    rejects({ ...VALID, css: "body{}" }, `"css" isn't part of a Look`);
    rejects({ ...VALID, thumbnail: "https://example.com/x.png" }, `"thumbnail" isn't part of a Look`);
  });

  it("rejects a wrong or missing schema, and another interface", () => {
    rejects({ ...VALID, schema: "automatos-interface-look/v0" }, `"schema" must be`);
    const noSchema = Object.fromEntries(Object.entries(VALID).filter(([key]) => key !== "schema"));
    rejects(noSchema, `"schema" must be`);
    rejects({ ...VALID, interface: "command" }, `"interface" must be "play"`);
  });

  it("rejects values outside the catalogue", () => {
    rejects({ ...VALID, ground: "midnight" }, `"ground" must be one of the catalogue's backgrounds: graphite, obsidian, indigo, paper.`);
    rejects({ ...VALID, accent: "#FF6A1F" }, `"accent" must be one of`);
    rejects({ ...VALID, font: "comic" }, `"font" must be one of`);
    rejects({ ...VALID, shell: "toString" }, `"shell" must be one of`);
    rejects({ ...VALID, light: { hex: "#FFFFFF" } }, `"light" must be one of`);
  });

  it("rejects a glow outside 0 to 40 or not a whole number", () => {
    for (const glow of [-1, 41, 12.5, "20", Number.NaN, null]) {
      rejects({ ...VALID, glow }, `"glow" must be a whole number from 0 to 40.`);
    }
  });

  it("rejects a name or sub over 40 characters, but counts characters, not UTF-16 units", () => {
    rejects({ ...VALID, name: "x".repeat(41) }, `"name" must be at most 40 characters.`);
    rejects({ ...VALID, sub: "x".repeat(41) }, `"sub" must be at most 40 characters.`);
    expect(validateLook({ ...VALID, name: "🔥".repeat(40) }).ok).toBe(true);
  });

  it("rejects a name that isn't one line of text, or is empty", () => {
    rejects({ ...VALID, name: 42 }, `"name" must be text.`);
    rejects({ ...VALID, name: "   " }, `"name" can't be empty.`);
    rejects({ ...VALID, sub: "two\nlines" }, `"sub" must be one line of plain text.`);
  });

  it("rejects a bad id", () => {
    for (const id of ["", "has space", "-dash-first", "x".repeat(65), 7]) {
      rejects({ ...VALID, id }, `"id" must be`);
    }
  });

  it("reports every problem at once and never echoes a long key back", () => {
    const longKey = "k".repeat(500);
    const errors = errorsFor({ ...VALID, accent: "neon", glow: 99, [longKey]: true });
    expect(errors).toHaveLength(3);
    expect(errors.every((error) => error.length < 200)).toBe(true);
  });
});
