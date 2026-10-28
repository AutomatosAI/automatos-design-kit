// PRD-261 B-06a: scripts/proof/guard.mjs, the proof guard. A proof branch changes only themes/<slug>/ and proof/<id>/,
// but package-lock.json's new workspace entries and the launcher's deletion of the leak paths; every leak path stays
// gone; the theme folder is new. Its pure functions are read here, then the script runs with Node against throwaway
// git repositories (tests/support/proof-git.ts), in both forms: <base-ref> <id> <slug>, and --ci as kit.yml's proof
// job runs it. The launcher, the audit and the protocol's files are in tests/proof-launch.test.ts and
// tests/proof-audit.test.ts.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  globToRegExp, guardFindings, isLeakPath, lockFindings, parseLeakList, parseNameStatus, resolveProof, shown,
  type GuardInput, type LockFile,
} from "../scripts/proof/guard.mjs";
import {
  BASE_TAG, BRANCH, COMMAND_FIXTURE, COMMAND_FOLDER, LEAK_FILES, LEAK_LIST, LOCKFILE, PROOF_ID, REFERENCES_TEST, SLUG,
  THEME_PACKAGE, baseLock, commitFiles, git, gitEnv, lockText, proofLock, proofRepo, sandbox,
} from "./support/proof-git.ts";

const GUARD = fileURLToPath(new URL("../scripts/proof/guard.mjs", import.meta.url));
const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const ERROR_LINE = /^::error::proof-guard: /;
const home = sandbox("proof-guard-");
afterAll(() => rmSync(home, { recursive: true, force: true }));

const leakEntries = parseLeakList(readFileSync(fileURLToPath(new URL(`../${LEAK_LIST}`, import.meta.url)), "utf8"));

/** A clean proof's guard input: the theme and proof files added, the leak files deleted, nothing else. */
function cleanInput(overrides: Partial<GuardInput> = {}): GuardInput {
  return {
    changes: [
      ...LEAK_FILES.map((path) => ({ status: "D", path })),
      { status: "A", path: `themes/${SLUG}/theme.json` },
      { status: "A", path: `proof/${PROOF_ID}/RUN.md` },
    ],
    id: PROOF_ID,
    slug: SLUG,
    leakEntries,
    headFiles: [`themes/${SLUG}/theme.json`, `proof/${PROOF_ID}/RUN.md`, "README.md"],
    themeAtBase: false,
    lock: [],
    ...overrides,
  };
}

describe("the leak list and its globs", () => {
  it("skips blank lines and comments", () => {
    expect(parseLeakList("# a comment\n\n  references/x  \n#another\nb/**/c*\n")).toEqual(["references/x", "b/**/c*"]);
  });

  it("names the Command folder, any fixture copy of it, and the test that reads it", () => {
    expect(leakEntries).toEqual([COMMAND_FOLDER, "packages/theme-cli/test/fixtures/**/command*", REFERENCES_TEST]);
  });

  it("takes a folder entry's every file, and a glob's matches at any depth, and nothing beside them", () => {
    [...LEAK_FILES, COMMAND_FOLDER, "packages/theme-cli/test/fixtures/a/b/command-looks/schema.json"]
      .forEach((path) => expect(isLeakPath(path, leakEntries), path).toBe(true));
    [`${COMMAND_FOLDER}er/README.md`, "references/designs/ember/README.md", "packages/theme-cli/test/fixtures/core/hello/theme.json",
      "tests/references.test.tsx", "themes/hud/src/command.ts"].forEach((path) => expect(isLeakPath(path, leakEntries), path).toBe(false));
  });

  it("reads * within one folder, ** across folders, and every other character as itself", () => {
    expect(globToRegExp("a/*.ts").test("a/b.ts")).toBe(true);
    expect(globToRegExp("a/*.ts").test("a/b/c.ts")).toBe(false);
    expect(globToRegExp("a/**/c").test("a/c")).toBe(true);
    expect(globToRegExp("a/**/c").test("a/b/d/c")).toBe(true);
    expect(globToRegExp("a.b").test("axb")).toBe(false);
  });
});

describe("the guard's decision", () => {
  it("passes a clean proof: its theme and proof folders, and the launcher's deletion of the leak paths", () => {
    expect(guardFindings(cleanInput())).toEqual([]);
  });

  it("fails a file outside the two folders, one sentence naming each path", () => {
    const changes = [...cleanInput().changes, { status: "M", path: "README.md" }, { status: "A", path: "themes/play/x.ts" }];
    const findings = guardFindings(cleanInput({ changes }));
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatch(/^README\.md is changed, outside themes\/harbour\/ and proof\/b06\/: /);
    expect(findings[1]).toMatch(/^themes\/play\/x\.ts is added, outside /);
  });

  it("fails a leak path changed rather than deleted, and a leak path still at HEAD", () => {
    const changes = [...cleanInput().changes, { status: "M", path: COMMAND_FIXTURE }];
    expect(guardFindings(cleanInput({ changes }))).toEqual([expect.stringContaining(`${COMMAND_FIXTURE} is changed, outside`)]);
    const headFiles = [...cleanInput().headFiles, REFERENCES_TEST];
    expect(guardFindings(cleanInput({ headFiles }))).toEqual([expect.stringContaining(`${REFERENCES_TEST} is a leak path`)]);
  });

  it("fails a deletion outside the leak list", () => {
    const changes = [...cleanInput().changes, { status: "D", path: "guides/looks.md" }];
    expect(guardFindings(cleanInput({ changes }))).toEqual([expect.stringContaining("guides/looks.md is deleted, outside")]);
  });

  it("fails a theme folder the base has already, and a proof that adds no theme", () => {
    expect(guardFindings(cleanInput({ themeAtBase: true }))).toEqual([expect.stringContaining("is at the base already")]);
    const changes = cleanInput().changes.filter(({ path }) => !path.startsWith("themes/"));
    expect(guardFindings(cleanInput({ changes }))).toEqual([expect.stringContaining("adds nothing under themes/harbour/")]);
  });

  it("leaves the lockfile to the lock's own sentences", () => {
    const changes = [...cleanInput().changes, { status: "M", path: LOCKFILE }];
    expect(guardFindings(cleanInput({ changes }))).toEqual([]);
    expect(guardFindings(cleanInput({ changes, lock: ["the lock's sentence"] }))).toEqual(["the lock's sentence"]);
  });

  it("quotes a path that holds a line break, so no path can start a line of its own", () => {
    expect(shown("a\n::warning::b")).toBe('"a\\n::warning::b"');
    expect(shown("references/designs/x y.html")).toBe("references/designs/x y.html");
  });

  it("reads git's NUL-separated name-status output", () => {
    expect(parseNameStatus("M\0README.md\0D\0a b/c\0A\0themes/x/y\0")).toEqual([
      { status: "M", path: "README.md" }, { status: "D", path: "a b/c" }, { status: "A", path: "themes/x/y" },
    ]);
  });
});

describe("the lockfile: only the new workspace's own entries may change", () => {
  const base = baseLock() as LockFile;

  it("passes the new workspace's folder and its node_modules link", () => {
    expect(lockFindings(base, proofLock() as LockFile, SLUG, THEME_PACKAGE)).toEqual([]);
  });

  it("fails any other entry changed, added or removed, naming it", () => {
    const changed = proofLock({ "node_modules/eslint": { version: "9.40.0", dev: true } }) as LockFile;
    expect(lockFindings(base, changed, SLUG, THEME_PACKAGE)).toEqual([expect.stringContaining('entry node_modules/eslint changed')]);
    const added = proofLock({ [`themes/${SLUG}/node_modules/left-pad`]: { version: "1.3.0" } }) as LockFile;
    expect(lockFindings(base, added, SLUG, THEME_PACKAGE)).toEqual([expect.stringContaining(`themes/${SLUG}/node_modules/left-pad`)]);
    const kept = Object.entries((proofLock() as LockFile).packages ?? {}).filter(([key]) => key !== "node_modules/eslint");
    const removed = { ...base, packages: Object.fromEntries(kept) };
    expect(lockFindings(base, removed, SLUG, THEME_PACKAGE)).toEqual([expect.stringContaining("entry node_modules/eslint changed")]);
  });

  it("fails a link that is not the new folder's, or that re-points an entry the base has", () => {
    const wrong = proofLock({ [`node_modules/${THEME_PACKAGE}`]: { resolved: "themes/play", link: true } }) as LockFile;
    expect(lockFindings(base, wrong, SLUG, THEME_PACKAGE)).toHaveLength(1);
    const packages = { ...base.packages, "node_modules/@automatos/theme-play": { resolved: `themes/${SLUG}`, link: true }, [`themes/${SLUG}`]: {} };
    expect(lockFindings(base, { ...base, packages }, SLUG, "@automatos/theme-play"))
      .toEqual([expect.stringContaining("node_modules/@automatos/theme-play changed")]);
  });

  it("fails a top-level field changed", () => {
    expect(lockFindings(base, { ...(proofLock() as LockFile), lockfileVersion: 2 }, SLUG, THEME_PACKAGE))
      .toEqual([expect.stringContaining("lockfileVersion changed")]);
  });
});

describe("which proof a pull request's branch holds (--ci)", () => {
  const baseFile = { path: `proof/${PROOF_ID}/BASE`, text: `${BASE_TAG}\n` };

  it("reads the id from the one BASE file, the tag from its line, the slug from the branch", () => {
    expect(resolveProof(BRANCH, [baseFile])).toEqual({ id: PROOF_ID, slug: SLUG, base: BASE_TAG });
  });

  it("refuses none or two BASE files, a branch that is not proof/<id>-<slug>, a bad slug and a BASE of two lines", () => {
    expect(() => resolveProof(BRANCH, [])).toThrow(/exactly one proof\/<id>\/BASE; this one holds 0/);
    expect(() => resolveProof(BRANCH, [baseFile, { path: "proof/b07/BASE", text: "x\n" }])).toThrow(/holds 2/);
    expect(() => resolveProof("proof/b07-harbour", [baseFile])).toThrow(/is not proof\/b06-<slug>/);
    expect(() => resolveProof("proof/b06-x", [baseFile])).toThrow(/not a theme folder's name/);
    expect(() => resolveProof(BRANCH, [{ ...baseFile, text: `${BASE_TAG}\nmain\n` }])).toThrow(/one tag name on one line/);
  });
});

interface Outcome {
  readonly status: number | null;
  readonly output: string;
}

function runGuard(cwd: string, args: readonly string[], env: Readonly<Record<string, string>> = {}): Outcome {
  const run = spawnSync(process.execPath, [GUARD, ...args], { cwd, env: { ...gitEnv(home), ...env }, encoding: "utf8" });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

describe("scripts/proof/guard.mjs <base-ref> <id> <slug>, against a git repository", () => {
  it("passes a proof branch made as the launcher makes one, its lock gaining the new workspace", () => {
    const outcome = runGuard(proofRepo(home), [BASE_TAG, PROOF_ID, SLUG]);
    expect(outcome.status, outcome.output).toBe(EXIT_OK);
    expect(outcome.output).toContain("proof-guard: every change from kit-b06-base to HEAD for proof b06 (themes/harbour) is in scope.");
  });

  it("fails a change outside the proof's folders, naming the path on an error line", () => {
    const repo = proofRepo(home);
    commitFiles(repo, { "guides/new.md": "# new\n" }, home);
    const outcome = runGuard(repo, [BASE_TAG, PROOF_ID, SLUG]);
    expect(outcome.status, outcome.output).toBe(EXIT_FAILED);
    expect(outcome.output.split("\n").filter((line) => ERROR_LINE.test(line))).toEqual([
      expect.stringContaining("guides/new.md is added, outside themes/harbour/ and proof/b06/"),
    ]);
  });

  it("fails a lock entry changed beyond the new workspace's", () => {
    const repo = proofRepo(home);
    commitFiles(repo, { [LOCKFILE]: lockText(proofLock({ "node_modules/eslint": { version: "9.40.0" } })) }, home);
    const outcome = runGuard(repo, [BASE_TAG, PROOF_ID, SLUG]);
    expect(outcome.status, outcome.output).toBe(EXIT_FAILED);
    expect(outcome.output).toMatch(/::error::proof-guard: package-lock\.json's entry node_modules\/eslint changed/);
  });

  it("fails a leak path brought back from the base", () => {
    const repo = proofRepo(home);
    git(repo, ["checkout", BASE_TAG, "--", REFERENCES_TEST], home);
    git(repo, ["commit", "-q", "-m", "bring it back"], home);
    const outcome = runGuard(repo, [BASE_TAG, PROOF_ID, SLUG]);
    expect(outcome.status, outcome.output).toBe(EXIT_FAILED);
    expect(outcome.output).toContain(`${REFERENCES_TEST} is a leak path (${LEAK_LIST}) and is still at HEAD`);
  });

  it("refuses bad arguments with the usage line", () => {
    const repo = proofRepo(home);
    [[], [BASE_TAG, PROOF_ID], [BASE_TAG, "B06", SLUG], [BASE_TAG, PROOF_ID, "x"], ["--ci", PROOF_ID, SLUG]].forEach((args) => {
      const outcome = runGuard(repo, args);
      expect(outcome.status, args.join(" ")).toBe(EXIT_USAGE);
      expect(outcome.output).toContain("usage: node scripts/proof/guard.mjs");
    });
  });
});

describe("scripts/proof/guard.mjs --ci, as kit.yml's proof job runs it", () => {
  /** A clone of a proof repository, as the job's checkout has it: the proof branch, origin the repository. */
  function checkout(): string {
    const clone = join(mkdtempSync(join(home, "checkout-")), "kit");
    git(home, ["clone", "-q", "-b", BRANCH, pathToFileURL(proofRepo(home)).href, clone], home);
    return clone;
  }

  it("fetches the base tag BASE names, guards the diff and writes theme=themes/<slug> for the shots", () => {
    const clone = checkout();
    const output = join(mkdtempSync(join(home, "output-")), "github-output");
    writeFileSync(output, "");
    const outcome = runGuard(clone, ["--ci"], { HEAD_REF: BRANCH, GITHUB_OUTPUT: output });
    expect(outcome.status, outcome.output).toBe(EXIT_OK);
    expect(readFileSync(output, "utf8")).toBe(`theme=themes/${SLUG}\n`);
    expect(git(clone, ["rev-parse", "--verify", `refs/tags/${BASE_TAG}`], home).trim()).toMatch(/^[0-9a-f]{40}$/);
  });

  it("fails a branch whose name doesn't match the proof's folder, with a sentence", () => {
    const outcome = runGuard(checkout(), ["--ci"], { HEAD_REF: "proof/b07-harbour" });
    expect(outcome.status, outcome.output).toBe(EXIT_FAILED);
    expect(outcome.output).toMatch(/^::error::proof-guard: the branch proof\/b07-harbour is not proof\/b06-<slug>/m);
  });
});
