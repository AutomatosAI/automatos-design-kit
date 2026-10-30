// scripts/shots/other-themes.mjs, the harness job's shots of every theme but Play and HUD: it finds each theme folder
// (one with a theme.json) under themes/, leaves out Play and HUD, which have steps of their own, and shoots each into
// a folder of the upload that no other step's shots take.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error: a plain .mjs script with no types
import { OTHER_SHOTS_OUT, otherThemes, SHOT_ELSEWHERE } from "../scripts/shots/other-themes.mjs";

const made: string[] = [];

function kitWith(themes: Readonly<Record<string, boolean>>): string {
  const root = mkdtempSync(join(tmpdir(), "kit-other-shots-"));
  made.push(root);
  Object.entries(themes).forEach(([name, isTheme]) => {
    mkdirSync(join(root, "themes", name), { recursive: true });
    if (isTheme) writeFileSync(join(root, "themes", name, "theme.json"), "{}");
  });
  return root;
}

afterEach(() => made.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("the other themes' shots", () => {
  it("finds every theme folder but Play and HUD, in order", () => {
    expect(otherThemes(kitWith({ play: true, hud: true, zeta: true, arcade: true, notes: false }))).toEqual(["arcade", "zeta"]);
    expect(SHOT_ELSEWHERE).toEqual(["play", "hud"]);
  });

  it("finds none in a kit with only Play and HUD, or with no themes folder", () => {
    expect(otherThemes(kitWith({ play: true, hud: true }))).toEqual([]);
    expect(otherThemes(kitWith({}))).toEqual([]);
  });

  it("shoots into a folder of the upload beside Play's groups and HUD's", () => {
    expect(OTHER_SHOTS_OUT).toBe("packages/theme-harness/dist/shots/themes");
  });
});
