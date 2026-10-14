// @vitest-environment node
import { describe, expect, it } from "vitest";

import { duskOf } from "@/lib/looks/css";
import { AURORA, EMBER } from "@/lib/looks/presets";
import type { Look } from "@/lib/looks/types";
import { RING_VARS, ringColour, ringTone, type RingTone } from "@/lib/mascot/ring";
import { MASCOT_STATES, type MascotName } from "@/lib/mascot/types";

import { cssRules, declarations, readSource, resolveTokens, stylesheets, themeTokens } from "../a11y/css";

const CALM: readonly MascotName[] = ["hello", "idle", "listening", "celebrate"];
const BUSY: readonly MascotName[] = ["thinking", "working", "searching", "reading"];
const DUSK: readonly MascotName[] = ["sleeping", "lost"];
const TONES = Object.keys(RING_VARS) as RingTone[];

function coloursOf(states: readonly MascotName[], look: Look): readonly string[] {
  return [...new Set(states.map((state) => ringColour(state, look)))];
}

describe("ringTone", () => {
  it("lights the ring by state group: calm, busy, oops, asleep or lost, loading", () => {
    const tones = Object.fromEntries(MASCOT_STATES.map((state) => [state, ringTone(state)]));
    expect(tones).toEqual({
      hello: "light",
      idle: "light",
      listening: "light",
      celebrate: "light",
      thinking: "accent",
      working: "accent",
      searching: "accent",
      reading: "accent",
      oops: "error",
      sleeping: "dusk",
      lost: "dusk",
      loading: "quiet",
    });
  });
});

describe("ringColour", () => {
  it("under Ember: mint light calm, molten busy, coral oops, a graphite dusk asleep and lost", () => {
    expect(coloursOf(CALM, EMBER)).toEqual(["#4BF0B7"]);
    expect(coloursOf(BUSY, EMBER)).toEqual(["#FF6A1F"]);
    expect(ringColour("oops", EMBER)).toBe("#FF6B6B");
    expect(coloursOf(DUSK, EMBER)).toEqual(["#5D5753"]);
    expect(ringColour("loading", EMBER)).toBe("#B7ADA4");
  });

  it("under Aurora: ice light calm, mint accent busy, the same coral oops, an obsidian dusk", () => {
    expect(coloursOf(CALM, AURORA)).toEqual(["#9FD8FF"]);
    expect(coloursOf(BUSY, AURORA)).toEqual(["#4BF0B7"]);
    expect(ringColour("oops", AURORA)).toBe("#FF6B6B");
    expect(coloursOf(DUSK, AURORA)).toEqual(["#4F4F51"]);
    expect(ringColour("loading", AURORA)).toBe("#A1A1A6");
  });

  it("makes dusk from the ground only, never the light or the accent", () => {
    const changed: Look = { ...EMBER, accent: "rose", light: "amber", shell: "cobalt" };
    expect(ringColour("sleeping", changed)).toBe(duskOf("graphite"));
    expect(ringColour("lost", { ...EMBER, ground: "paper" })).toBe(duskOf("paper"));
    expect(duskOf("paper")).toBe("#B6AFA9");
  });

  it("is pure: the Look is read, never changed", () => {
    const look = Object.freeze({ ...AURORA });
    expect(ringColour("working", look)).toBe(ringColour("working", look));
    expect(look).toEqual(AURORA);
  });
});

describe("the ring in mascot.module.css", () => {
  const tokens = themeTokens();
  const rules = cssRules(readSource("components/mascot/mascot.module.css"));

  /** The --ring a tone's rule sets, resolved through the theme to the Look variable. */
  function ringVarFor(tone: RingTone): string | undefined {
    const selector = tone === "light" ? ".stage" : `.stage[data-ring="${tone}"]`;
    const rule = rules.find((candidate) => candidate.selector === selector);
    const value = declarations(rule?.body ?? "").find((declaration) => declaration.property === "--ring")?.value;
    return value === undefined ? undefined : resolveTokens(value, tokens);
  }

  it("draws each tone in the same Look variable as ringColour", () => {
    for (const tone of TONES) expect({ tone, ring: ringVarFor(tone) }).toEqual({ tone, ring: `var(${RING_VARS[tone]})` });
  });

  it("draws the ring itself in --ring", () => {
    const ring = rules.find((rule) => rule.selector === ".ring");
    expect(ring?.body).toMatch(/border: 2px solid var\(--ring\)/);
  });
});

describe("Auto's light (the Ember rule)", () => {
  const tokens = themeTokens();
  const LIGHT = "var(--auto-light)";
  /** Where the light may appear: the ring's calm colour, his eyes and their glow, and "connected". */
  const ALLOWED = [
    "components/mascot/mascot.module.css .stage",
    "components/mascot/mascot.module.css .eye",
    'components/shell/shell.module.css .dot[data-status="connected"]',
  ];

  it("is used only for the ring, the eyes' glow and the connected dot", () => {
    const uses = stylesheets().flatMap((file) =>
      cssRules(readSource(file))
        .filter((rule) => !(file === "app/theme.css" && rule.selector === ":root"))
        .filter((rule) => declarations(rule.body).some((decl) => resolveTokens(decl.value, tokens).includes(LIGHT)))
        .map((rule) => `${file} ${rule.selector}`),
    );
    expect([...new Set(uses)].sort()).toEqual([...ALLOWED].sort());
  });

  it("is never a theme token other than Auto's own", () => {
    const users = [...tokens]
      .filter(([, value]) => resolveTokens(value, tokens).includes(LIGHT))
      .map(([name]) => name)
      .sort();
    expect(users).toEqual(["--color-light", "--shadow-light-glow"]);
  });
});
