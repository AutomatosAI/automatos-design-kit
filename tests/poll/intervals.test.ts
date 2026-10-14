// @vitest-environment node
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { POLL_INTERVALS, type PollIntervalName } from "@/lib/poll/intervals";

import { filesUnder, readSource } from "../a11y/css";

// The skill's "Poll gently" as numbers. Each minimum is quoted from the skill reference
// it comes from: if the skill changes, the quote stops matching and this test says so.

const SKILL = "skills/build-automatos-interface/references";

const MINIMUMS: Readonly<Record<PollIntervalName, { readonly ms: number; readonly file: string; readonly quote: string }>> = {
  MISSION_DETAIL: { ms: 10_000, file: "missions.md", quote: "every **10 s or slower**" },
  FLEET: { ms: 10_000, file: "agents-playbooks.md", quote: "Studio polls it every **10 s**" },
  LIST: { ms: 30_000, file: "missions.md", quote: "Poll the list every **30 s or slower**" },
  DOCUMENT_PROCESSING: { ms: 5_000, file: "knowledge.md", quote: "every 5–10 s while something is processing" },
  PLAYBOOK_RUN: { ms: 10_000, file: "agents-playbooks.md", quote: "Poll an open run every 10 s" },
  BOARD_SAFETY: { ms: 60_000, file: "board-analytics.md", quote: "keep a 60 s list refetch as a safety net" },
};

/** Code that might poll: everything Play ships, minus the hook and the table themselves. */
function pollingSources(): readonly string[] {
  const own = new Set([join("hooks", "usePoll.ts"), join("lib", "poll", "intervals.ts"), join("lib", "poll", "poller.ts")]);
  return ["app", "components", "hooks", "lib"]
    .flatMap((dir) => filesUnder(dir, [".ts", ".tsx"]))
    .filter((file) => !own.has(file) && !/\.test\.tsx?$/.test(file));
}

describe("poll intervals", () => {
  it("names every interval the pages use", () => {
    expect(Object.keys(POLL_INTERVALS).sort()).toEqual(Object.keys(MINIMUMS).sort());
    expect(POLL_INTERVALS).toEqual({
      MISSION_DETAIL: 10_000,
      FLEET: 10_000,
      LIST: 30_000,
      DOCUMENT_PROCESSING: 7_000,
      PLAYBOOK_RUN: 10_000,
      BOARD_SAFETY: 60_000,
    });
  });

  it("quotes each minimum from the skill", () => {
    for (const [name, minimum] of Object.entries(MINIMUMS)) {
      const text = readSource(join(SKILL, minimum.file));
      expect({ name, quoted: text.includes(minimum.quote) }).toEqual({ name, quoted: true });
    }
    expect(readSource("skills/build-automatos-interface/SKILL.md")).toContain(
      "Mission detail and the fleet every 10 s, lists every 30 s",
    );
  });

  it("never polls faster than the skill allows", () => {
    for (const name of Object.keys(POLL_INTERVALS) as PollIntervalName[]) {
      const ms = POLL_INTERVALS[name];
      expect({ name, ms, gentle: ms >= MINIMUMS[name].ms }).toEqual({ name, ms, gentle: true });
    }
  });

  it("is the only place intervals come from: every usePoll caller imports the table", () => {
    for (const file of pollingSources()) {
      const source = readSource(file);
      if (!/\busePoll\(/.test(source)) continue;
      const imports = /import \{[^}]*\bPOLL_INTERVALS\b[^}]*\} from "@\/lib\/poll\/intervals"/.test(source);
      expect({ file, imports }).toEqual({ file, imports: true });
      expect({ file, literal: /\busePoll\(\s*[\w.]+\s*,\s*\d/.test(source) }).toEqual({ file, literal: false });
    }
  });

  it("drives the shelf's refresh from the list interval", () => {
    expect(readSource("lib/deliverables/shelf.ts")).toContain("SHELF_REFRESH_MS = POLL_INTERVALS.LIST");
  });
});
