// @vitest-environment node
import { describe, expect, it } from "vitest";

import { INITIAL_MASCOT, mascotReducer } from "@/lib/mascot/reducer";
import type { MascotEvent, MascotName } from "@/lib/mascot/types";

import { fixtureEvents, FIXTURES, type FixtureName } from "../stream/helpers";
import { deepFreeze, replay, sequence } from "./helpers";

// Each recorded turn as the chat hook will feed it: the user sends, the stream
// plays, and the player reports the end of any one-shot clip.
function turn(name: FixtureName): MascotEvent[] {
  return [{ type: "send" }, ...fixtureEvents(name)];
}

const CELEBRATE_ENDED: MascotEvent = { type: "clip-ended", state: "celebrate" };

const EXPECTED: Readonly<Record<FixtureName, readonly MascotName[]>> = {
  "plain-answer": ["thinking", "idle"],
  "web-search": ["thinking", "searching", "idle", "celebrate", "idle"],
  "error-turn": ["thinking", "oops"],
  "ask-waiting": ["thinking", "working", "listening"],
  "reasoning-narration": ["thinking", "idle", "reading", "idle", "thinking", "idle", "celebrate", "idle"],
  "mission-suggestion": ["thinking", "idle"],
};

describe("mascot reducer on the recorded turns", () => {
  it.each(FIXTURES)("%s plays the expected states", (name) => {
    expect(sequence([...turn(name), CELEBRATE_ENDED])).toEqual(EXPECTED[name]);
  });

  it("plain answer: thinking until the first words, then idle", () => {
    expect(sequence(turn("plain-answer"))).toEqual(["thinking", "idle"]);
    expect(replay(turn("plain-answer"))).toMatchObject({ mascot: "idle", turnActive: false });
  });

  it("web search: celebrates on finish and holds it until the clip ends", () => {
    expect(sequence(turn("web-search"))).toEqual(["thinking", "searching", "idle", "celebrate"]);
    const celebrating = replay(turn("web-search"));
    expect(celebrating.mascot).toBe("celebrate");
    expect(mascotReducer(celebrating, CELEBRATE_ENDED).mascot).toBe("idle");
  });

  it("error turn: ends on oops (there is no finish frame) and closes the turn", () => {
    const state = replay(turn("error-turn"));
    expect(state).toMatchObject({ mascot: "oops", turnActive: false, openTools: [] });
  });

  it("ask: Auto stays listening after the turn finishes, waiting for the owner", () => {
    const state = replay(turn("ask-waiting"));
    expect(state.mascot).toBe("listening");
    expect(state.turnActive).toBe(false);
    expect(mascotReducer(state, CELEBRATE_ENDED)).toBe(state);
  });

  it("the next message after an error starts thinking again", () => {
    const failed = replay(turn("error-turn"));
    expect(sequence(turn("plain-answer"), failed)).toEqual(["thinking", "idle"]);
  });

  it.each(FIXTURES)("%s never mutates the state it is given", (name) => {
    const events = turn(name);
    expect(() =>
      events.reduce((state, event) => mascotReducer(deepFreeze(state), event), INITIAL_MASCOT),
    ).not.toThrow();
  });
});
