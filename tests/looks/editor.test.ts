// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  asNewLook,
  baseLook,
  clampGlow,
  freshLookId,
  glowLabel,
  isEdited,
  newLookName,
  SAVED_SUB,
  statusLine,
  withValues,
} from "@/lib/looks/editor";
import { AURORA, EMBER, WORKSHOP } from "@/lib/looks/presets";
import { LOOK_ID_PATTERN } from "@/lib/looks/types";
import { validateLook } from "@/lib/looks/validate";

import { myLook } from "./helpers";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe("baseLook and isEdited", () => {
  it("finds the preset or saved Look the active one was picked from", () => {
    expect(baseLook(withValues(AURORA, { accent: "rose" }), [])).toBe(AURORA);
    const mine = myLook();
    expect(baseLook({ ...mine, glow: 0 }, [mine])).toBe(mine);
    expect(baseLook(myLook({ id: "gone" }), [mine])).toBeUndefined();
  });

  it("is edited only when a value differs from that Look", () => {
    expect(isEdited(EMBER, [])).toBe(false);
    expect(isEdited(withValues(EMBER, { glow: 0 }), [])).toBe(true);
    expect(isEdited(withValues(EMBER, { accent: "molten" }), [])).toBe(false);
    expect(isEdited(myLook(), [myLook()])).toBe(false);
    expect(isEdited(myLook({ shell: "cobalt" }), [myLook()])).toBe(true);
    // A name change alone (a rename) is not an edit of the values.
    expect(isEdited({ ...EMBER, name: "Mine" }, [])).toBe(false);
  });

  it("can't call a Look edited when there is nothing to compare it with", () => {
    expect(isEdited(myLook({ id: "gone", accent: "gold" }), [])).toBe(false);
  });
});

describe("statusLine", () => {
  it("names the Look, and adds '· edited' once it is changed", () => {
    expect(statusLine(EMBER, [])).toBe("Ember");
    expect(statusLine(withValues(EMBER, { font: "round" }), [])).toBe("Ember · edited");
    expect(statusLine(myLook({ light: "ice" }), [myLook()])).toBe("My look 1 · edited");
  });
});

describe("withValues", () => {
  it("returns a new Look and leaves the old one alone", () => {
    const frozen = deepFreeze({ ...WORKSHOP });
    const next = withValues(frozen, { ground: "paper", glow: 3 });
    expect(next).toEqual({ ...WORKSHOP, ground: "paper", glow: 3 });
    expect(frozen).toEqual(WORKSHOP);
  });
});

describe("the glow", () => {
  it("stays a whole number from 0 to 40", () => {
    expect(clampGlow(24)).toBe(24);
    expect(clampGlow(12.6)).toBe(13);
    expect(clampGlow(-3)).toBe(0);
    expect(clampGlow(99)).toBe(40);
    expect(clampGlow(Number.NaN)).toBe(0);
  });

  it("reads Off at 0 and as a percentage otherwise", () => {
    expect(glowLabel(0)).toBe("Off");
    expect(glowLabel(24)).toBe("24%");
    expect(glowLabel(40)).toBe("40%");
  });
});

describe("Save as new look", () => {
  it("names the next one 'My look N', skipping names already taken", () => {
    expect(newLookName([])).toBe("My look 1");
    expect(newLookName([myLook()])).toBe("My look 2");
    expect(newLookName([myLook({ id: "a", name: "My look 2" })])).toBe("My look 3");
  });

  it("gives it an id no preset or saved Look has", () => {
    expect(freshLookId([])).toBe("look-1");
    expect(freshLookId([myLook({ id: "look-1" }), myLook({ id: "look-3" })])).toBe("look-2");
    expect(freshLookId([])).toMatch(LOOK_ID_PATTERN);
  });

  it("keeps the active values under the new id, name and line, and validates", () => {
    const edited = withValues(EMBER, { accent: "rose", glow: 30 });
    const fresh = asNewLook(edited, [myLook()]);
    expect(fresh).toEqual({ ...edited, id: "look-1", name: "My look 2", sub: SAVED_SUB });
    expect(validateLook(fresh)).toEqual({ ok: true, look: fresh });
    expect(edited.id).toBe("ember");
  });
});
