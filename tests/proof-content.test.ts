// PRD-261 B-06a: the audit's content check (scripts/proof/leak-content.mjs), the authoritative leak check. On seeded
// leak files and base lines: a leak file's line of MIN_FINGERPRINT_LENGTH characters or more that no other file holds
// is a fingerprint; a line HUD holds too, whole or inside a longer line, is not; a short line is not; a leak file's
// whole text counts when it has a line of its own. A tool result holding a fingerprint (after a line number or a
// patch's minus, in a text block, or JSON-escaped), or a leak file's whole text, is reported with the leak file and
// the turn, never the text. Then the base and its fingerprints are read from throwaway proof repositories
// (tests/support/proof-git.ts). The command checks are in tests/proof-audit.test.ts.
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { audit, type AuditContext } from "../scripts/proof/audit.mjs";
import {
  baseFingerprints, baseTexts, findBase, findLeakContent, fingerprints, FINGERPRINT_MAX, MIN_FINGERPRINT_LENGTH, parseBatch,
} from "../scripts/proof/leak-content.mjs";
import {
  BASE_TAG, BRANCH, COMMAND_FIXTURE, COMMAND_FOLDER, LEAK_FILES, PROOF_ID, SLUG, commitFiles, git, proofRepo, sandbox,
  upstream,
} from "./support/proof-git.ts";

/** Seeded leak files: Command's brief, its look schema, a preset of short lines only, and one HUD holds all of. */
const BRIEF = `${COMMAND_FOLDER}/README.md`;
const SCHEMA = `${COMMAND_FOLDER}/looks/schema.json`;
const PRESET = `${COMMAND_FOLDER}/looks/presets/arc.look.json`;
const SHARED_FILE = `${COMMAND_FOLDER}/looks/presets/forge.look.json`;
/** A line only Command's brief holds. */
const OWN = "The rail glows amber while Auto works through a long task.";
/** A line HUD's files hold too, whole. */
const SHARED = '"accent": { "kind": "choice", "choices": ["signal", "amber"] },';
/** A line HUD holds inside a longer line of its own. */
const INSIDE = "export const SCAN_SPEED_SECONDS = 4.5";
/** A line of the schema with quotes in it, which JSON escapes. */
const QUOTED = '"note": "the scan line sweeps once every four and a half seconds",';
const SHORT = "## Looks";
const ONE_SHORT = "y".repeat(MIN_FINGERPRINT_LENGTH - 1);
const LONG_ENOUGH = "z".repeat(MIN_FINGERPRINT_LENGTH);
const TEXTS = {
  [BRIEF]: `# Command\n\n${OWN}\n  ${SHARED}\n${INSIDE}\n${SHORT}\n${ONE_SHORT}\n${LONG_ENOUGH}\n`,
  [SCHEMA]: `{\n  ${QUOTED}\n  "glow": 0.8\n}\n`,
  [PRESET]: '{\n  "glow": 0.8,\n  "scan": 4.5,\n  "grid": 24\n}\n',
  [SHARED_FILE]: `${SHARED}\n${SHORT}\n`,
};
const LEAK_TEXTS = Object.entries(TEXTS).map(([path, text]) => ({ path, text }));
/** The trimmed lines of HUD's files, which share a line with the brief and hold another inside one of theirs. */
const HUD_LINES = [SHARED, `${INSIDE}; // HUD's scan line`, SHORT, "}", "{"];
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const prints = fingerprints({ leakFiles: LEAK_TEXTS, otherLines: HUD_LINES });

type Input = Readonly<Record<string, unknown>>;

/** One assistant message (its id) with one tool call (`toolId`). */
const call = (messageId: string, toolId: string, name: string, input: Input): unknown => ({
  type: "assistant", message: { id: messageId, role: "assistant", content: [{ type: "tool_use", id: toolId, name, input }] },
});
/** A tool result the run was shown, for the call `toolId`. */
const result = (toolId: string, content: unknown): unknown => ({
  type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, content }] },
});
const bash = (command: string): Input => ({ command });

describe("a leak file's fingerprints", () => {
  it("are its own lines: not a line HUD holds too, whole or inside a longer line, and not a line shorter than the minimum", () => {
    expect(MIN_FINGERPRINT_LENGTH).toBe(32);
    expect(prints.lines).toEqual([
      { file: BRIEF, line: OWN }, { file: BRIEF, line: LONG_ENOUGH }, { file: SCHEMA, line: QUOTED },
    ]);
  });

  it("hold a whole text when the file has a line of its own, even of short lines, and never one HUD holds all of", () => {
    expect(prints.hashes).toEqual([BRIEF, SCHEMA, PRESET].map((file) => ({ file, sha256: sha256(TEXTS[file].trim()) })));
    expect(prints.files).toBe(4);
  });

  it("cut a long line to its first FINGERPRINT_MAX characters, so a tool that cuts it short still shows one", () => {
    const long = `${OWN} ${"w".repeat(FINGERPRINT_MAX)}`;
    expect(fingerprints({ leakFiles: [{ path: BRIEF, text: long }], otherLines: [] }).lines).toEqual([{ file: BRIEF, line: long.slice(0, FINGERPRINT_MAX) }]);
  });
});

describe("a tool result that shows a leak file's text", () => {
  const events = [
    call("m1", "t1", "Read", { file_path: "themes/harbour/notes.md" }),
    result("t1", `     1\t# Harbour\n     2\t${SHARED}\n     3\t${INSIDE}; // HUD's scan line\n`),
    call("m2", "t2", "Bash", bash("npm run build")),
    result("t2", [{ type: "text", text: `diff\n-  ${OWN}\n` }]),
    result("t2", `     7\t${OWN}`),
    call("m3", "t3", "Bash", bash("node scripts/print.mjs")),
    result("t3", JSON.stringify({ schema: TEXTS[SCHEMA] })),
    call("m4", "t4", "Bash", bash("npm test")),
    result("t4", `${TEXTS[PRESET].trim()}\n`),
    result("t9", `${LONG_ENOUGH} from a call the transcript does not hold`),
  ];

  it("is reported with the leak file and the turn, once each: a numbered line, a patch line, JSON-escaped, a whole text", () => {
    expect(findLeakContent(events, prints)).toEqual([
      { file: BRIEF, turn: 2 }, { file: SCHEMA, turn: 3 }, { file: PRESET, turn: 4 }, { file: BRIEF, turn: null },
    ]);
  });

  it("is not reported for a line the leak file shares with HUD, or a short line", () => {
    expect(findLeakContent([call("m1", "t1", "Read", {}), result("t1", `${SHARED}\n${SHORT}\n${ONE_SHORT}`)], prints)).toEqual([]);
  });

  describe("in the audit's report", () => {
    const context: AuditContext = {
      place: { roots: ["/work/proofs/b06-harbour"], home: "/work/owner", toolchain: [], rootEntries: [] },
      leakEntries: [], branch: BRANCH, proofFolders: [`themes/${SLUG}`, `proof/${PROOF_ID}`], isPath: () => false, deny: [],
    };

    it("flags each, first, naming the file and the turn and never the text, and says what the check holds", () => {
      const report = audit(events, { ...context, fingerprints: prints });
      expect(report.flagged).toBe(true);
      expect(report.lines.slice(1)).toEqual([
        "proof-audit: the content check holds 3 lines and 3 whole texts of 4 leak files.",
        `leak-content: ${BRIEF} seen in turn 2`, `leak-content: ${SCHEMA} seen in turn 3`, `leak-content: ${PRESET} seen in turn 4`,
        `leak-content: ${BRIEF} seen in turn unknown`, "proof-audit: 4 flagged.",
      ]);
      [OWN, QUOTED, LONG_ENOUGH, '"grid": 24'].forEach((text) => expect(report.lines.join("\n")).not.toContain(text));
    });

    it("flags a content check that could not run", () => {
      const report = audit([], { ...context, contentError: "the content check could not run: no history" });
      expect(report.lines.slice(1)).toEqual(["leak-content: the content check could not run: no history", "proof-audit: 1 flagged."]);
    });
  });
});

describe("the base and its fingerprints, from the clone's history", () => {
  const home = sandbox("proof-content-");
  afterAll(() => rmSync(home, { recursive: true, force: true }));

  it("is the parent of the launcher's deletion commit, the base tag's commit, and its leak files give the fingerprints", () => {
    const repo = proofRepo(home);
    const base = git(repo, ["rev-parse", BASE_TAG], home).trim();
    expect(findBase(repo)).toBe(base);
    const found = baseFingerprints(repo, base);
    expect(found.files).toBe(LEAK_FILES.length);
    expect(found.lines).toEqual(expect.arrayContaining([{ file: COMMAND_FIXTURE, line: `made up: ${COMMAND_FIXTURE}` }]));
    expect(found.lines.map(({ file }) => file).sort()).toEqual([...LEAK_FILES].sort());
  });

  it("is the base tag's commit when the clone has no deletion commit", () => {
    const repo = upstream(home);
    git(repo, ["switch", "-q", "-c", BRANCH], home);
    commitFiles(repo, { [`proof/${PROOF_ID}/BASE`]: `${BASE_TAG}\n` }, home, "the proof folder");
    expect(findBase(repo)).toBe(git(repo, ["rev-parse", BASE_TAG], home).trim());
  });

  it("refuses a base tag that moved off the deletion commit's parent, and a clone with neither", () => {
    const repo = proofRepo(home);
    git(repo, ["tag", "-f", BASE_TAG, "HEAD"], home);
    expect(() => findBase(repo)).toThrow("but the base tag is at");
    const bare = mkdtempSync(join(home, "plain-"));
    git(bare, ["init", "-q", "-b", "main"], home);
    commitFiles(bare, { "README.md": "# kit\n" }, home);
    expect(() => findBase(bare)).toThrow("neither the launcher's deletion commit nor a proof/<id>/BASE tag");
  });

  it("reads only the base's text files: a file with a NUL in it is left out", () => {
    const repo = mkdtempSync(join(home, "binary-"));
    git(repo, ["init", "-q", "-b", "main"], home);
    commitFiles(repo, { "README.md": "# kit\n", [`${COMMAND_FOLDER}/mark.bin`]: "\u0000made up: a binary mark of the reference\n" }, home);
    expect(baseTexts(repo, "HEAD").map(({ path }) => path)).toEqual(["README.md"]);
  });

  it("parses git cat-file --batch output, a missing object as empty", () => {
    const parsed = parseBatch(Buffer.from("abc blob 3\nxyz\nmissing-object missing\ndef blob 0\n\n"));
    expect(parsed.map((object) => object.toString("utf8"))).toEqual(["xyz", "", ""]);
  });
});
