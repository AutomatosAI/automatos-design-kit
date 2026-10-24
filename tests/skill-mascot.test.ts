// PRD-261 B-04b: the design-a-mascot skill is held to the code it describes, so the two can't drift. states.md lists
// @automatos/mascot's states (packages/mascot/src/types.ts MASCOT_STATES) in order, each with its one-shot, urgent and
// ring columns as types.ts and ring.ts have them. clip-specs.md gives each mascot file's kind and cap as the kit's
// reader has them (packages/theme-cli/src/files.ts: CAPS.clip for the .webm and the .mp4, the still kind's 512 KB for
// the .png, CAPS.package for the package), the clip length as player.ts CLIP_MS, and names the .webm's VP9 alpha and
// the .mp4's HEVC alpha. placement.md links guides/mascot-placement.md and names the three placement slots, read from
// the host's slots (package-manifest.ts KNOWN_SLOTS). The skills lint (skills.test.ts) covers the rest of the folder.
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLIP_MS } from "../packages/mascot/src/player.ts";
import { ringTone } from "../packages/mascot/src/ring.ts";
import { MASCOT_STATES, ONE_SHOTS, URGENT } from "../packages/mascot/src/types.ts";
import { KNOWN_SLOTS } from "../packages/theme-cli/src/core/package-manifest.ts";
import { CAPS, fileKind, KB, MB } from "../packages/theme-cli/src/files.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILL_DIR = "skills/design-a-mascot";
const SKILL_MD = `${SKILL_DIR}/SKILL.md`;
const STATES_MD = `${SKILL_DIR}/references/states.md`;
const CLIP_SPECS_MD = `${SKILL_DIR}/references/clip-specs.md`;
const PLACEMENT_MD = `${SKILL_DIR}/references/placement.md`;
const PLACEMENT_GUIDE = "guides/mascot-placement.md";

const STATES_SECTION = "Auto's states";
const CAPS_SECTION = "The files and their caps";
const CODECS_SECTION = "Codecs";
const LENGTH_SECTION = "Length and size";

const PLAYS = { oneShot: "once", loop: "loops" } as const;
const SWAPS = { urgent: "at once", boundary: "at the clip's end" } as const;
const STATE_ROW = /^\| `[a-z][a-z0-9-]*` \|/;
/** A caps row: the mascot file (by extension) or the whole package, its kind, and its cap in KB or MB. */
const CAP_ROW = /^\| (?:`assets\/mascot\/<state>\.([a-z0-9]+)`|the whole (package)) \| ([a-z]+) \| (\d+) (KB|MB) \|/;
const UNIT_BYTES: Readonly<Record<string, number>> = { KB, MB };
const CLIP_EXTENSIONS = ["webm", "mp4"];
const STILL_EXTENSION = "png";
const PACKAGE_ROW = "package";
const CODECS = [{ extension: ".webm", codec: "VP9 alpha" }, { extension: ".mp4", codec: "HEVC alpha" }];
const MS_PER_SECOND = 1000;
const LINK = /\]\(([^)\s]+)\)/g;
/** A placement slot names a part of a core page (`page-header.art@1`); the other slots are one word (`frame@1`). */
const PLACEMENT_SLOT = /^[a-z]+(?:-[a-z]+)*\.[a-z]+@\d+$/;
const PLACEMENT_SLOT_COUNT = 3;

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** The text of one `## <heading>` section, up to the next `## ` heading. */
function sectionOf(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) throw new Error(`no "## ${heading}" section`);
  const end = text.indexOf("\n## ", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
}

/** A table row's cells, trimmed, without backticks. */
function cells(line: string): string[] {
  return line.split("|").slice(1, -1).map((cell) => cell.trim().replaceAll("`", ""));
}

/** Every relative link of `file`, as a repo-relative path. */
function linkTargets(file: string): string[] {
  return Array.from(readText(file).matchAll(LINK), (match) => match[1].split("#")[0])
    .map((target) => normalize(join(dirname(file), target)));
}

interface CapRow {
  readonly kind: string;
  readonly bytes: number;
}

/** clip-specs.md's caps table, keyed by file extension, and `package` for the whole package. */
function capRows(): ReadonlyMap<string, CapRow> {
  const lines = sectionOf(readText(CLIP_SPECS_MD), CAPS_SECTION).split("\n");
  return new Map(lines.flatMap((line): [string, CapRow][] => {
    const row = CAP_ROW.exec(line);
    if (row === null) return [];
    return [[row[1] ?? row[2], { kind: row[3], bytes: Number(row[4]) * UNIT_BYTES[row[5]] }]];
  }));
}

describe("states.md lists @automatos/mascot's states as the code has them", () => {
  const lines = sectionOf(readText(STATES_MD), STATES_SECTION).split("\n");
  const rows = lines.filter((line) => STATE_ROW.test(line)).map((line) => cells(line));
  const byState = new Map(rows.map((row): [string, string[]] => [row[0], row]));

  it("lists exactly the states of MASCOT_STATES, in its order", () => {
    expect(rows.map((row) => row[0])).toEqual([...MASCOT_STATES]);
  });

  it.each([...MASCOT_STATES])("%s plays, swaps in and takes its ring tone as the code says", (state) => {
    const [, , plays, swaps, ring] = byState.get(state) ?? [];
    expect(plays).toBe(ONE_SHOTS.has(state) ? PLAYS.oneShot : PLAYS.loop);
    expect(swaps).toBe(URGENT.has(state) ? SWAPS.urgent : SWAPS.boundary);
    expect(ring).toBe(ringTone(state));
  });
});

describe("clip-specs.md's caps are the reader's", () => {
  const rows = capRows();
  const sample = (extension: string): string => `assets/mascot/${MASCOT_STATES[0]}.${extension}`;

  it.each([...CLIP_EXTENSIONS, STILL_EXTENSION])("the .%s row has the kind and cap files.ts gives it", (extension) => {
    const kind = fileKind(sample(extension));
    expect(kind).toBeDefined();
    expect(rows.get(extension)).toEqual({ kind: kind?.name, bytes: kind?.cap });
  });

  it.each(CLIP_EXTENSIONS)("the .%s clip's cap is CAPS.clip", (extension) => {
    expect(rows.get(extension)?.bytes).toBe(CAPS.clip);
  });

  it("the .png is the still kind, at the still's cap", () => {
    expect(fileKind(sample(STILL_EXTENSION))?.name).toBe("still");
    expect(rows.get(STILL_EXTENSION)?.bytes).toBe(fileKind(sample(STILL_EXTENSION))?.cap);
  });

  it("the whole package's cap is CAPS.package", () => {
    expect(rows.get(PACKAGE_ROW)?.bytes).toBe(CAPS.package);
  });

  it("gives every clip the length the player swaps at (CLIP_MS)", () => {
    expect(sectionOf(readText(CLIP_SPECS_MD), LENGTH_SECTION)).toContain(`${CLIP_MS / MS_PER_SECOND} s (\`CLIP_MS\``);
  });
});

describe("clip-specs.md names each clip's codec", () => {
  const lines = sectionOf(readText(CLIP_SPECS_MD), CODECS_SECTION).split("\n");

  it.each(CODECS)("the $extension row names $codec", ({ extension, codec }) => {
    const row = lines.find((line) => line.startsWith(`| \`${extension}\` |`));
    expect(row).toBeDefined();
    expect(row).toContain(codec);
  });
});

describe("placement.md links the placement guide and names the three placement slots", () => {
  const text = readText(PLACEMENT_MD);
  const slots = KNOWN_SLOTS.filter((slot) => PLACEMENT_SLOT.test(slot));

  it(`links ${PLACEMENT_GUIDE}`, () => expect(linkTargets(PLACEMENT_MD)).toContain(normalize(PLACEMENT_GUIDE)));

  it("finds three placement slots among the host's slots", () => expect(slots).toHaveLength(PLACEMENT_SLOT_COUNT));

  it.each(slots)("names %s", (slot) => expect(text).toContain(`\`${slot}\``));
});

describe("SKILL.md links its three references", () => {
  it.each([STATES_MD, CLIP_SPECS_MD, PLACEMENT_MD])("links %s", (reference) => {
    expect(linkTargets(SKILL_MD)).toContain(normalize(reference));
  });
});
