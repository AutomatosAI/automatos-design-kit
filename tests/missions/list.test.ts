// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  cardProgress,
  checkGoal,
  cursorAfter,
  durationWords,
  emptyListMessage,
  GOAL_MAX,
  goalCounter,
  goalPreview,
  hasMore,
  mergeCursors,
  mergeMissions,
  MISSION_FILTERS,
  missionAge,
  missionCount,
  missionHref,
  statesFor,
  statFigures,
  tokensLine,
  tooLongSentence,
  totalOf,
  UNTITLED_MISSION,
} from "@/lib/missions/list";
import { parseMission } from "@/lib/missions/parse";
import type { Mission, MissionStats } from "@/lib/missions/types";

// The Missions list, pure: which states each chip asks for, merging pages, and the words.

function mission(id: string, createdAt: string | null, state = "running"): Mission {
  const parsed = parseMission({ id, goal: `Goal ${id}`, state, created_at: createdAt });
  if (!parsed) throw new Error("bad fixture");
  return parsed;
}

describe("the filter chips", () => {
  it("are All, Active, Needs you, Done and Failed, in that order", () => {
    expect(MISSION_FILTERS.map((option) => option.label)).toEqual(["All", "Active", "Needs you", "Done", "Failed"]);
  });

  it("map to the backend's state filters, one call per state", () => {
    expect(statesFor("all")).toEqual([undefined]);
    expect(statesFor("needs-you")).toEqual(["awaiting_approval", "awaiting_human"]);
    expect(statesFor("done")).toEqual(["completed"]);
    expect(statesFor("failed")).toEqual(["failed"]);
    expect(statesFor("active")).toEqual(["pending", "planning", "replanning", "running", "verifying", "paused"]);
  });

  it("say what is missing when a filter matches nothing", () => {
    expect(emptyListMessage("all")).toMatch(/^No Missions yet\./);
    expect(emptyListMessage("needs-you")).toBe("Nothing needs you right now.");
    expect(emptyListMessage("failed")).toBe("No failed Missions.");
  });
});

describe("merging pages", () => {
  it("keeps the newest first and lets a fresh row replace an old one", () => {
    const old = [mission("a", "2026-10-14T09:00:00Z", "running"), mission("b", "2026-10-13T09:00:00Z")];
    const fresh = [mission("a", "2026-10-14T09:00:00Z", "completed"), mission("c", "2026-10-14T11:00:00Z")];

    const merged = mergeMissions(old, fresh);

    expect(merged.map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(merged.find((row) => row.id === "a")?.state).toBe("completed");
    expect(old.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("puts a row with no date last", () => {
    const merged = mergeMissions([mission("x", null)], [mission("y", "2026-10-01T00:00:00Z")]);
    expect(merged.map((row) => row.id)).toEqual(["y", "x"]);
  });

  it("tracks how far each state has been read and whether there is more", () => {
    const first = { awaiting_approval: cursorAfter(0, 20, 25), awaiting_human: cursorAfter(0, 3, 3) };
    expect(totalOf(first)).toBe(28);
    expect(hasMore(first)).toBe(true);

    const after = mergeCursors(first, { awaiting_approval: cursorAfter(20, 5, 26) });
    expect(after).toEqual({ awaiting_approval: { loaded: 25, total: 26 }, awaiting_human: { loaded: 3, total: 3 } });
    expect(hasMore(after)).toBe(true);
  });

  it("ends a query whose page came back empty, whatever its total said", () => {
    expect(cursorAfter(20, 0, 30)).toEqual({ loaded: 30, total: 30 });
    expect(hasMore({ all: cursorAfter(20, 0, 30) })).toBe(false);
  });
});

describe("a card's words", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("says how old the Mission is", () => {
    expect(missionAge("2026-10-14T11:59:30Z", now)).toBe("Just now");
    expect(missionAge("2026-10-14T11:55:00Z", now)).toBe("5 min ago");
    expect(missionAge("2026-10-14T09:00:00Z", now)).toBe("3 h ago");
    expect(missionAge("2026-10-13T11:00:00Z", now)).toBe("1 day ago");
    expect(missionAge("2026-10-10T12:00:00Z", now)).toBe("4 days ago");
    expect(missionAge(null, now)).toBe("");
    expect(missionAge("not a date", now)).toBe("");
  });

  it("names the tokens used once there are any", () => {
    expect(tokensLine(0)).toBeNull();
    expect(tokensLine(12400)).toBe("12,400 tokens");
  });

  it("draws the bar from the backend's counts, and none without them", () => {
    const progress = { total: 4, done: 1, active: 1, verified: 1, failed: 0, skipped: 0, allTerminal: false };
    expect(cardProgress(progress)).toEqual({ value: 1, max: 4, label: "1 of 4 steps done" });
    expect(cardProgress({ ...progress, total: 1, done: 1 })?.label).toBe("1 of 1 step done");
    expect(cardProgress({ ...progress, total: 0 })).toBeNull();
    expect(cardProgress(null)).toBeNull();
  });

  it("shows the goal on one line, cut to a card's worth", () => {
    expect(goalPreview("  Plan\n\nthe   launch ")).toBe("Plan the launch");
    expect(goalPreview("   ")).toBe(UNTITLED_MISSION);
    const long = goalPreview("word ".repeat(200));
    expect(long.length).toBeLessThanOrEqual(240);
    expect(long.endsWith("…")).toBe(true);
  });

  it("opens the Mission's own page", () => {
    expect(missionHref("9d2b/x")).toBe("/missions/9d2b%2Fx");
    expect(missionCount(1)).toBe("1 Mission");
    expect(missionCount(12)).toBe("12 Missions");
  });
});

describe("the stats strip", () => {
  const stats: MissionStats = {
    totalMissions: 12,
    successRate: 0.75,
    avgDurationMinutes: 65.4,
    avgTokensUsed: 0,
    avgTasksPerMission: 0,
    topAgents: [],
    commonFailureReasons: {},
    period: "30d",
  };

  it("shows Missions, the success rate (sent as 0-1) and the average time", () => {
    expect(statFigures(stats)).toEqual([
      { label: "Missions", value: "12" },
      { label: "Success rate", value: "75%" },
      { label: "Average time", value: "1 h 5 min" },
    ]);
  });

  it("puts durations in words", () => {
    expect(durationWords(null)).toBe("—");
    expect(durationWords(0.4)).toBe("Under a minute");
    expect(durationWords(45)).toBe("45 min");
    expect(durationWords(120)).toBe("2 h");
  });
});

describe("the goal", () => {
  it("is sent trimmed, and must be 1 to 10000 characters", () => {
    expect(checkGoal("  Plan the launch ")).toEqual({ ok: true, goal: "Plan the launch" });
    expect(checkGoal("   ")).toEqual({ ok: false, reason: "empty", length: 0 });
    expect(checkGoal("x".repeat(GOAL_MAX))).toMatchObject({ ok: true });
    expect(checkGoal("x".repeat(GOAL_MAX + 1))).toEqual({ ok: false, reason: "too-long", length: GOAL_MAX + 1 });
  });

  it("counts what will be sent and says how far over it is", () => {
    expect(goalCounter(" Plan ")).toBe("4 / 10,000");
    expect(tooLongSentence(GOAL_MAX + 1)).toBe("That's 1 character over the limit. Shorten the goal to start.");
    expect(tooLongSentence(GOAL_MAX + 250)).toMatch(/^That's 250 characters over/);
  });
});
