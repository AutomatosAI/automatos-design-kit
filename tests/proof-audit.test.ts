// PRD-261 B-06a: scripts/proof/audit.mjs, the proof audit's command checks. Seeded stream-json transcripts, as `claude
// -p --output-format stream-json --verbose` writes them, against a made-up clone: a clean run passes; a path outside
// the clone, a leak path, a ref other than HEAD or the proof branch, a patch walk beyond the proof's folders, the web
// and a deny-file line are each flagged, with the turn and the call, however the command escapes or quotes them;
// Node's and npm's own paths are allowed. Then the script runs with Node on a throwaway proof repository. The content
// check is in tests/proof-content.test.ts, the guard in tests/proof.test.ts, the launcher in tests/proof-launch.test.ts.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  audit, callFlags, gitRefProblem, parseDenyList, placeOf, TOOLCHAIN_PATHS, type AuditContext, type Place,
} from "../scripts/proof/audit.mjs";
import { parseLeakList } from "../scripts/proof/guard.mjs";
import { commandWords, gitInvocations, gitLocations, shellCommands } from "../scripts/proof/shell.mjs";
import { parseTranscript, runSummary, toolCalls, type ToolCall } from "../scripts/proof/transcript.mjs";
import {
  BRANCH, COMMAND_FIXTURE, COMMAND_FOLDER, LEAK_LIST, PROOF_ID, REFERENCES_TEST, ROOT, SLUG, gitEnv, proofRepo, sandbox,
} from "./support/proof-git.ts";

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
/** The proof's own folders: a history walk's patches may be limited to them. */
const PROOF_FOLDERS = [`themes/${SLUG}`, `proof/${PROOF_ID}`];
/** The Command folder with a backslash in its name, as a command may escape it, never holding the name whole. */
const ESCAPED_COMMAND = COMMAND_FOLDER.replace("command", "com\\mand");
const leakEntries = parseLeakList(readFileSync(join(ROOT, LEAK_LIST), "utf8"));
const RESULT = { type: "result", subtype: "success", num_turns: 3, total_cost_usd: 0.5, duration_ms: 1234 };

type Input = Readonly<Record<string, unknown>>;

function context(overrides: Partial<AuditContext> = {}): AuditContext {
  return {
    place: PLACE, leakEntries, branch: BRANCH, proofFolders: PROOF_FOLDERS, isPath: (word) => CLONE_FILES.has(word), deny: [],
    ...overrides,
  };
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
    bash("git log --oneline -n 5 2>&1 | head"), bash("git log -p -- themes/harbour > /tmp/log.txt"),
    bash('git add themes/harbour && git commit -s -m "feat: the frame: header, rail and panels"'),
    bash("node -e \"console.log(['/chat', '/agents'].join())\""),
  );

  it("passes, with no flag", () => {
    const report = audit(events, context());
    expect(report.flagged).toBe(false);
    expect(report.lines).toEqual([expect.stringContaining("15 tool calls"), "proof-audit: clean."]);
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
    expect(flagsOf("Bash", { command: `git -C ${HOME}/kit log` }))
      .toEqual([`outside: ${HOME}/kit`, `git-ref: git works in ${HOME}/kit, outside the clone`]);
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
    ["git -C /tmp/another-kit log --oneline", "git works in /tmp/another-kit, outside the clone"],
    ["git --git-dir=/tmp/another-kit/.git status", "git works in /tmp/another-kit/.git, outside the clone"],
    ["git grep -e frame kit-b06-base", "git grep names kit-b06-base, not HEAD or proof/b06-harbour"],
  ])("a git command beyond the proof branch: %s", (command, problem) => {
    expect(flagsOf("Bash", { command })).toEqual([`git-ref: ${problem}`]);
  });

  it.each([
    ["git log -p -- themes/harbour references", "references"],
    ["git log -p README.md", "README.md"],
    ["git whatchanged -p -- packages", "packages"],
    ["git log -p -- themes/harbour/../../references", "themes/harbour/../../references"],
    ["git log -p -- :(top)references", ":(top)references"],
  ])("a patch walk with a path outside the proof's folders, where the deletion's text may be: %s", (command, path) => {
    expect(flagsOf("Bash", { command })).toEqual([`git-ref: git ${command.split(" ")[1]} prints history's patches for ${path}, outside themes/harbour/ and proof/b06/`]);
  });

  it("a patch walk with no path at all, a bare -- included, and any patch walk with a path when the proof's folders are unknown", () => {
    expect(flagsOf("Bash", { command: "git log -p --" })).toEqual(["git-ref: git log prints every commit's patch, the launcher's deletion included"]);
    expect(gitRefProblem(["log", "-p", "--", "themes/harbour"], BRANCH, () => false))
      .toBe("git log prints history's patches for themes/harbour, outside the proof's folders");
  });

  it.each([
    ["git grep -o frame kit-b06-base", "-o is --only-matching for git grep, no value"],
    ["git grep -A 3 frame kit-b06-base", "-A takes git grep's context lines"],
    ["git log -f kit-b06-base", "-e and -f take a value in git grep alone"],
    ["git grep -eframe kit-b06-base", "an attached -e"],
    ["git grep -fpatterns.txt kit-b06-base", "an attached -f"],
    ["git grep --regexp=frame kit-b06-base", "an attached --regexp"],
    ["git grep --regexp frame kit-b06-base", "--regexp takes the next word"],
    ["git grep -iefoo kit-b06-base", "-e in a bundle of short options"],
  ])("git's options as each command takes them: %s (%s)", (command) => {
    const name = command.split(" ")[1];
    expect(flagsOf("Bash", { command })).toEqual([`git-ref: git ${name} names kit-b06-base, not HEAD or proof/b06-harbour`]);
  });

  it("not HEAD, the proof branch, a range between them, a file of the clone, or a patch walk inside the proof's folders", () => {
    ["git diff HEAD", `git log HEAD..${BRANCH}`, "git log README.md", "git log -p themes/harbour", "git status --short",
      "git -C themes/harbour status", `git -C ${CLONE} log --oneline`, "git grep frame", "git grep -e frame -- themes/harbour",
      "git log -p -- themes/harbour proof/b06", "git log -p -- ./themes/harbour/src", "git log --patch -- themes/harbour/ 2>&1",
      "git grep -C 2 frame", "git grep -n -m 5 frame -- themes/harbour", "git status 2> /dev/null"]
      .forEach((command) => expect(flagsOf("Bash", { command }), command).toEqual([]));
  });

  it("whatever the shell's escapes and quotes hide: an escaped command, a joined line, an escaped leak path or outside path", () => {
    expect(flagsOf("Bash", { command: "git l\\og -p" })).toEqual(["git-ref: git log prints every commit's patch, the launcher's deletion included"]);
    expect(flagsOf("Bash", { command: "git log \\\n  -p" })).toEqual(["git-ref: git log prints every commit's patch, the launcher's deletion included"]);
    expect(flagsOf("Bash", { command: "git 'log' \"-p\"" })).toEqual(["git-ref: git log prints every commit's patch, the launcher's deletion included"]);
    expect(flagsOf("Bash", { command: `cat ${ESCAPED_COMMAND}/README.md` })).toEqual([`leak: ${COMMAND_FOLDER}/README.md`]);
    expect(flagsOf("Bash", { command: `node -e "require('fs').readFileSync('${ESCAPED_COMMAND}/README.md')"` }))
      .toEqual([`leak: ${COMMAND_FOLDER}/README.md`]);
    expect(flagsOf("Bash", { command: `node -e 'require("fs").readFileSync("${ESCAPED_COMMAND}/README.md")'` }))
      .toEqual([`leak: ${COMMAND_FOLDER}/README.md`]);
    expect(flagsOf("Bash", { command: "cat \\/etc/hosts" })).toEqual(["outside: /etc/hosts"]);
  });

  it("not a regular expression for a path: a backslash the shell keeps inside quotes is passed on as written", () => {
    expect(flagsOf("Bash", { command: `grep -rn "\\/home\\/owner" themes/harbour` })).toEqual([]);
    expect(flagsOf("Bash", { command: "node -e \"/\\.ts$/.test(f)\" > /tmp/out.txt" })).toEqual([]);
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
    expect(gitLocations("git -C a log && git --git-dir=b/.git --work-tree c status; git status")).toEqual(["a", "b/.git", "c"]);
  });

  it("reads a command line as the shell does: commands, quotes taken off, escapes applied, a backslash and a line break joined", () => {
    expect(shellCommands("git l\\og -p && echo 'a\\b' \"c\\d\" \"e\\\"f\" g\\ h || x; y | z\nw")).toEqual([
      ["git", "log", "-p"], ["echo", "a\\b", "c\\d", "e\"f", "g h"], ["x"], ["y"], ["z"], ["w"],
    ]);
    expect(shellCommands("git log \\\n -p 2>&1")).toEqual([["git", "log", "-p", "2>&1"]]);
    expect(shellCommands("echo '' \"open")).toEqual([["echo", "", "open"]]);
  });

  it("splits a command into words, keeping a word with a backslash the shell leaves (a regular expression)", () => {
    expect(commandWords("node -e \"/\\.ts$/.test(f)\" > /tmp/out.txt")).toEqual(["node", "-e", "/\\.ts$/.test", "f", "/tmp/out.txt"]);
  });

  it("leaves a git command's redirections out of its words", () => {
    expect(gitInvocations("git log -n 5 2>&1 > out.txt && git status &>/dev/null < in")).toEqual([["log", "-n", "5"], ["status"]]);
  });
});

describe("scripts/proof/audit.mjs, run with Node", () => {
  const folder = sandbox("proof-audit-");
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  /** A throwaway proof repository, as the launcher and a run leave one (tests/support/proof-git.ts), and its transcript beside it. */
  function setUp(events: readonly unknown[]): { clone: string; transcript: string } {
    const clone = proofRepo(folder);
    const transcript = `${clone}.transcript.jsonl`;
    writeFileSync(transcript, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
    return { clone, transcript };
  }

  /** The audit, run with Node in git's test environment (its home the sandbox). */
  function runAudit(args: readonly string[]): { status: number | null; output: string } {
    const result = spawnSync(process.execPath, [AUDIT, ...args], { encoding: "utf8", env: gitEnv(folder) });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  /** A tool result the run was shown, answering the first call of the message `messageId`. */
  const shown = (messageId: string, content: string): unknown => ({
    type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: `toolu_${messageId}_0`, content }] },
  });

  it("exits 0 on a clean run, printing its numbers and what the content check holds", () => {
    const events = run(bash("npm ci"), ["Glob", { pattern: "themes/**" }]);
    const { clone, transcript } = setUp([...events.slice(0, 2), shown("msg_0", "added 812 packages"), ...events.slice(2)]);
    const outcome = runAudit([transcript, clone]);
    expect(outcome.status, outcome.output).toBe(EXIT_OK);
    expect(outcome.output).toContain("proof-audit: 2 tool calls; turns 3, cost 0.5 USD, duration 1234 ms.");
    expect(outcome.output).toContain("proof-audit: the content check holds 4 lines and 4 whole texts of 4 leak files.");
    expect(outcome.output).toContain("proof-audit: clean.");
  });

  it("exits 1 when a tool result showed a leak file's text, naming the file and the turn, never the text", () => {
    const events = run(bash("npm run build"));
    const { clone, transcript } = setUp([...events.slice(0, 2), shown("msg_0", `> build\nmade up: ${COMMAND_FIXTURE}\n`), ...events.slice(2)]);
    const outcome = runAudit([transcript, clone]);
    expect(outcome.status, outcome.output).toBe(EXIT_FLAGGED);
    expect(outcome.output).toMatch(new RegExp(`^leak-content: ${COMMAND_FIXTURE} seen in turn 1$`, "m"));
    expect(outcome.output).not.toContain("made up:");
  });

  it("exits 1 when the clone has no history to read the base from: the content check could not run", () => {
    const clone = join(mkdtempSync(join(folder, "proof-")), "clone");
    mkdirSync(join(clone, "proof"), { recursive: true });
    writeFileSync(join(clone, LEAK_LIST), readFileSync(join(ROOT, LEAK_LIST)));
    writeFileSync(`${clone}.transcript.jsonl`, `${run().map((event) => JSON.stringify(event)).join("\n")}\n`);
    const outcome = runAudit([`${clone}.transcript.jsonl`, clone]);
    expect(outcome.status, outcome.output).toBe(EXIT_FLAGGED);
    expect(outcome.output).toMatch(/^leak-content: the content check could not run: /m);
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
