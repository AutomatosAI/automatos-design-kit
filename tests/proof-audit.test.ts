// PRD-261 B-06a: scripts/proof/audit.mjs, the proof audit. Seeded stream-json transcripts, as `claude -p
// --output-format stream-json --verbose` writes them, against a made-up clone: a clean run passes; a path outside the
// clone, a leak path, a ref other than HEAD or the proof branch, the web and a deny-file line are each flagged, with
// the turn and the call; Node's and npm's own paths are allowed. Then the script runs with Node on files in a
// temporary folder. The guard is in tests/proof.test.ts, the launcher in tests/proof-launch.test.ts.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  audit, callFlags, commandWords, gitInvocations, gitRefProblem, parseDenyList, parseTranscript, placeOf, runSummary,
  TOOLCHAIN_PATHS, toolCalls, type AuditContext, type Place, type ToolCall,
} from "../scripts/proof/audit.mjs";
import { parseLeakList } from "../scripts/proof/guard.mjs";
import { BRANCH, COMMAND_FOLDER, LEAK_LIST, REFERENCES_TEST, ROOT, sandbox } from "./support/proof-git.ts";

const AUDIT = fileURLToPath(new URL("../scripts/proof/audit.mjs", import.meta.url));
const EXIT_OK = 0;
const EXIT_FLAGGED = 1;
const EXIT_USAGE = 2;
/** A made-up machine: the clone, the owner's home, the node binary's prefix and the names at /. */
const CLONE = "/work/proofs/b06-harbour";
const HOME = "/home/owner";
const NODE_PREFIX = "/usr/local";
const PLACE: Place = {
  roots: [CLONE],
  home: HOME,
  toolchain: [...TOOLCHAIN_PATHS, NODE_PREFIX],
  rootEntries: ["dev", "etc", "home", "private", "tmp", "usr", "work"],
};
/** The words that are files in the made-up clone (git log <file>). */
const CLONE_FILES = new Set(["themes/harbour", "themes/harbour/src/entry.ts", "README.md"]);
const leakEntries = parseLeakList(readFileSync(join(ROOT, LEAK_LIST), "utf8"));
const RESULT = { type: "result", subtype: "success", num_turns: 3, total_cost_usd: 0.5, duration_ms: 1234 };

type Input = Readonly<Record<string, unknown>>;

function context(overrides: Partial<AuditContext> = {}): AuditContext {
  return { place: PLACE, leakEntries, branch: BRANCH, isPath: (word) => CLONE_FILES.has(word), deny: [], ...overrides };
}

/** One assistant message (its id) holding these tool calls. */
function message(id: string, ...calls: ReadonlyArray<readonly [string, Input]>): unknown {
  const content = calls.map(([name, input], index) => ({ type: "tool_use", id: `toolu_${id}_${index}`, name, input }));
  return { type: "assistant", message: { id, role: "assistant", content }, parent_tool_use_id: null };
}

/** A run of one call per message, with its result line. */
const run = (...calls: ReadonlyArray<readonly [string, Input]>): unknown[] =>
  [{ type: "system", subtype: "init", cwd: CLONE }, ...calls.map((call, index) => message(`msg_${index}`, call)), RESULT];

const bash = (command: string): readonly [string, Input] => ["Bash", { command }];
const read = (path: string): readonly [string, Input] => ["Read", { file_path: path }];
const call = (tool: string, input: Input): ToolCall => ({ turn: 1, tool, input });
const flagsOf = (tool: string, input: Input, overrides: Partial<AuditContext> = {}): string[] => callFlags(call(tool, input), context(overrides));

describe("the transcript", () => {
  it("takes every tool call, a turn per assistant message, however many events the message is streamed in", () => {
    const events = [message("m1", read(`${CLONE}/README.md`)), message("m1", bash("npm ci")), { type: "user" }, message("m2", ["Glob", { pattern: "**" }])];
    expect(toolCalls(events).map(({ turn, tool }) => [turn, tool])).toEqual([[1, "Read"], [1, "Bash"], [2, "Glob"]]);
  });

  it("reads the run's turns, cost and duration from its result line, or says the run did not finish", () => {
    expect(runSummary(run())).toEqual({ turns: 3, costUsd: 0.5, durationMs: 1234 });
    expect(runSummary([message("m1", bash("npm ci"))])).toBeNull();
    expect(audit(run(), context()).lines[0]).toBe("proof-audit: 0 tool calls; turns 3, cost 0.5 USD, duration 1234 ms.");
    expect(audit([], context()).lines[0]).toContain("the transcript has no result line");
  });

  it("refuses a line that is not JSON, naming it", () => {
    expect(() => parseTranscript('{"type":"system"}\nnot json\n')).toThrow("line 2 of the transcript is not JSON.");
  });
});

describe("a clean run", () => {
  const events = run(
    read(`${CLONE}/README.md`), read("themes/harbour/src/entry.ts"), ["Glob", { pattern: "themes/**/*.ts" }],
    ["Grep", { pattern: "/api/documents", path: `${CLONE}/guides`, glob: "*.md" }],
    bash("npm ci"), bash("npx automatos-theme check themes/harbour"), bash("git status"), bash("git log --oneline -n 5"),
    bash("git diff HEAD -- themes/harbour"), bash("git log -p -- themes/harbour"), bash(`git log ${BRANCH}`),
    bash('git add themes/harbour && git commit -s -m "feat: the frame: header, rail and panels"'),
    bash("node -e \"console.log(['/chat', '/agents'].join())\""),
  );

  it("passes, with no flag", () => {
    const report = audit(events, context());
    expect(report.flagged).toBe(false);
    expect(report.lines).toEqual([expect.stringContaining("13 tool calls"), "proof-audit: clean."]);
  });

  it("allows Node's and npm's own paths: the npm cache, the temporary folders, /dev/null and the node binary's prefix", () => {
    const toolchain = [read(`~/.npm/_logs/debug.log`), bash("ls /tmp/vite && npm run build > /dev/null 2>&1"),
      read("/private/tmp/x.json"), read(`${NODE_PREFIX}/lib/node_modules/npm/package.json`)];
    expect(audit(run(...toolchain), context()).flagged).toBe(false);
    expect(placeOf("~/.npm/_cacache/x", PLACE)).toBe("toolchain");
    expect(placeOf("~/notes.md", PLACE)).toBe("outside");
  });
});

describe("what the audit flags", () => {
  it("a path outside the clone: a read, a relative path leaving it, a glob, a Bash word, a git -C", () => {
    expect(flagsOf("Read", { file_path: `${HOME}/other-repo/README.md` })).toEqual([`outside: ${HOME}/other-repo/README.md`]);
    expect(flagsOf("Bash", { command: "node scripts/x.mjs ../../secrets.txt" })).toEqual(["outside: ../../secrets.txt"]);
    expect(flagsOf("Glob", { pattern: "/etc/**/*.conf" })).toEqual(["outside: /etc/"]);
    expect(flagsOf("Grep", { pattern: "theme", path: "~/Documents" })).toEqual(["outside: ~/Documents"]);
    expect(flagsOf("Bash", { command: `git -C ${HOME}/kit log` })).toEqual([`outside: ${HOME}/kit`]);
  });

  it("a word from / only when its first folder is there, so a route is not a path", () => {
    expect(flagsOf("Bash", { command: "node -e \"fetch('/api/documents')\"" })).toEqual([]);
    expect(flagsOf("Bash", { command: "node -e \"require('/etc/hosts')\"" })).toEqual(["outside: /etc/hosts"]);
  });

  it("a leak path, inside the clone or in another checkout, by a read, a Bash word or a search", () => {
    expect(flagsOf("Read", { file_path: `${CLONE}/${COMMAND_FOLDER}/README.md` })).toEqual([`leak: ${CLONE}/${COMMAND_FOLDER}/README.md`]);
    expect(flagsOf("Bash", { command: `node -e "x" ${REFERENCES_TEST}` })).toEqual([`leak: ${REFERENCES_TEST}`]);
    const elsewhere = `${HOME}/kit/${COMMAND_FOLDER}/looks.json`;
    expect(flagsOf("Read", { file_path: elsewhere })).toEqual([`outside: ${elsewhere}`, `leak: ${elsewhere}`]);
    expect(flagsOf("Glob", { pattern: `${COMMAND_FOLDER}/**` })).toEqual([`leak: ${COMMAND_FOLDER}/**`]);
  });

  it.each([
    ["git log kit-b06-base", "git log names kit-b06-base, not HEAD or proof/b06-harbour"],
    ["git diff HEAD~1", "git diff names HEAD~1, not HEAD or proof/b06-harbour"],
    ["git show main:README.md", "git show names main:README.md, not HEAD or proof/b06-harbour"],
    ["git fetch origin", "git fetch reaches another repository"],
    ["git log --all --oneline", "git log names every ref"],
    ["git log -p", "git log prints every commit's patch, the launcher's deletion included"],
  ])("a git command beyond the proof branch: %s", (command, problem) => {
    expect(flagsOf("Bash", { command })).toEqual([`git-ref: ${problem}`]);
  });

  it("not HEAD, the proof branch, a range between them, or a file of the clone", () => {
    ["git diff HEAD", `git log HEAD..${BRANCH}`, "git log README.md", "git log -p themes/harbour", "git status --short"]
      .forEach((command) => expect(flagsOf("Bash", { command }), command).toEqual([]));
  });

  it("WebFetch and WebSearch", () => {
    expect(flagsOf("WebFetch", { url: "https://example.com/x", prompt: "read it" })).toEqual(["web: WebFetch"]);
    expect(flagsOf("WebSearch", { query: "a theme" })).toEqual(["web: WebSearch"]);
  });

  it("a deny-file line anywhere in a call, ignoring case, naming the line and never its text", () => {
    const deny = parseDenyList("# private names, one a line\n\nmade-up-product\n");
    expect(deny).toEqual([{ line: 3, pattern: "made-up-product" }]);
    expect(flagsOf("Bash", { command: "npm run build # Made-Up-Product" }, { deny })).toEqual(["deny: line 3 of the deny file"]);
    const report = audit(run(read(`${CLONE}/made-up-product.md`)), context({ deny }));
    expect(report.flagged).toBe(true);
    expect(report.lines[1]).toMatch(/^deny: line 3 of the deny file\tturn 1\tRead \{"file_path":/);
  });

  it("each flag on its own line: the flag, the turn, the call", () => {
    const report = audit(run(bash("npm ci"), ["WebSearch", { query: "x" }]), context());
    expect(report.lines).toEqual([expect.any(String), 'web: WebSearch\tturn 2\tWebSearch {"query":"x"}', "proof-audit: 1 flagged."]);
  });
});

describe("reading commands", () => {
  it("finds each git invocation, past environment assignments and git's own options", () => {
    expect(gitInvocations("FOO=1 git -C x -c a=b log -n 3 && npm test; /usr/bin/git status | cat")).toEqual([["log", "-n", "3"], ["status"]]);
    expect(gitRefProblem(["log", "-n", "3"], BRANCH, () => false)).toBeNull();
  });

  it("splits a command into words, leaving out a word with a backslash (a regular expression, not a path)", () => {
    expect(commandWords("node -e \"/\\.ts$/.test(f)\" > /tmp/out.txt")).toEqual(["node", "-e", "f", "/tmp/out.txt"]);
  });
});

describe("scripts/proof/audit.mjs, run with Node", () => {
  const folder = sandbox("proof-audit-");
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  /** A made-up clone with the kit's leak list, and its transcript beside it. */
  function setUp(events: readonly unknown[]): { clone: string; transcript: string } {
    const clone = join(mkdtempSync(join(folder, "proof-")), "clone");
    mkdirSync(join(clone, "proof"), { recursive: true });
    writeFileSync(join(clone, LEAK_LIST), readFileSync(join(ROOT, LEAK_LIST)));
    const transcript = `${clone}.transcript.jsonl`;
    writeFileSync(transcript, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
    return { clone, transcript };
  }

  function runAudit(args: readonly string[]): { status: number | null; output: string } {
    const result = spawnSync(process.execPath, [AUDIT, ...args], { encoding: "utf8" });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  it("exits 0 on a clean run, printing its numbers", () => {
    const { clone, transcript } = setUp(run(bash("npm ci"), ["Glob", { pattern: "themes/**" }]));
    const outcome = runAudit([transcript, clone]);
    expect(outcome.status, outcome.output).toBe(EXIT_OK);
    expect(outcome.output).toContain("proof-audit: 2 tool calls; turns 3, cost 0.5 USD, duration 1234 ms.");
    expect(outcome.output).toContain("proof-audit: clean.");
  });

  it("exits 1 on a flagged run, with a line for each flag", () => {
    const { clone, transcript } = setUp(run(read("/etc/hostname"), ["WebSearch", { query: "x" }]));
    const outcome = runAudit([transcript, clone]);
    expect(outcome.status, outcome.output).toBe(EXIT_FLAGGED);
    expect(outcome.output).toMatch(/^outside: \/etc\/hostname\tturn 1\t/m);
    expect(outcome.output).toMatch(/^web: WebSearch\tturn 2\t/m);
  });

  it("flags a deny-file line with the file outside the clone, and refuses one inside it or this checkout", () => {
    const { clone, transcript } = setUp(run(bash("npm run build # made-up-product")));
    const deny = join(folder, "deny.txt");
    writeFileSync(deny, "made-up-product\n");
    expect(runAudit([transcript, clone, "--deny", deny]).output).toMatch(/^deny: line 1 of the deny file\tturn 1\t/m);
    writeFileSync(join(clone, "deny.txt"), "made-up-product\n");
    const inside = runAudit([transcript, clone, "--deny", join(clone, "deny.txt")]);
    expect(inside.status).toBe(EXIT_USAGE);
    expect(inside.output).toContain("is inside");
    expect(runAudit([transcript, clone, "--deny", join(ROOT, "README.md")]).status).toBe(EXIT_USAGE);
  });

  it("refuses a transcript inside the clone, bad arguments, and a transcript that is not stream-json", () => {
    const { clone, transcript } = setUp(run());
    writeFileSync(join(clone, "t.jsonl"), readFileSync(transcript));
    expect(runAudit([join(clone, "t.jsonl"), clone]).status).toBe(EXIT_USAGE);
    expect(runAudit([transcript]).status).toBe(EXIT_USAGE);
    expect(runAudit([transcript, clone, "--deny"]).status).toBe(EXIT_USAGE);
    writeFileSync(transcript, "not json\n");
    const broken = runAudit([transcript, clone]);
    expect(broken.status).toBe(EXIT_FLAGGED);
    expect(broken.output).toContain("line 1 of the transcript is not JSON.");
  });
});
