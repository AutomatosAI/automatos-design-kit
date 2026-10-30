// scripts/release/bumped.mjs, theme-publish.yml's pick of the themes a merge publishes, and the tag rule it shares
// with theme-release.yml (scripts/release/themes.mjs). The decisions are checked as pure functions, then the command
// runs with Node against throwaway git repositories: an upstream holding theme folders, release/publishers.json and
// tags, cloned as the pick job checks it out. git runs with no system or user config.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { decide, EXIT_OK, EXIT_REFUSED, EXIT_USAGE, identify, picked } from "../scripts/release/bumped.mjs";
import { parsePublishers, parseTag, TAG_PATTERN } from "../scripts/release/themes.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/release/bumped.mjs", import.meta.url));
const PUBLISHERS = ["automatos", "pixelcade"];
const PUBLISHERS_JSON = `${JSON.stringify({ publishers: PUBLISHERS })}\n`;
const ARCADE = { slug: "arcade", publisher: "pixelcade", id: "pixelcade/arcade", version: "0.1.1" };
const sandbox = mkdtempSync(join(tmpdir(), "release-bumped-"));
const GIT_ENV = {
  PATH: process.env.PATH ?? "", HOME: sandbox, LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull,
  GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_NAME: "Kit Test", GIT_AUTHOR_EMAIL: "kit-test@example.com",
  GIT_COMMITTER_NAME: "Kit Test", GIT_COMMITTER_EMAIL: "kit-test@example.com",
};

interface Ran {
  readonly status: number | null;
  /** The picked themes, from the one line of JSON on stdout; null when stdout held none. */
  readonly themes: ReadonlyArray<Record<string, string>> | null;
  readonly log: string;
}

function git(cwd: string, args: readonly string[]): string {
  const run = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout.trim();
}

const manifest = (id: string, version: string): string => `${JSON.stringify({ schema: "automatos-theme/v1", id, version })}\n`;

function commit(repo: string, files: Readonly<Record<string, string>>): string {
  Object.entries(files).forEach(([rel, body]) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), body);
  });
  git(repo, ["add", "--", ...Object.keys(files)]);
  git(repo, ["commit", "-q", "-m", `change ${Object.keys(files).join(", ")}`]);
  return git(repo, ["rev-parse", "HEAD"]);
}

/** An upstream on main: the publishers list, and each theme folder's theme.json (folder: [id, version]). */
function upstream(themes: Readonly<Record<string, readonly [string, string]>>): string {
  const repo = mkdtempSync(join(sandbox, "upstream-"));
  git(repo, ["init", "-q", "-b", "main"]);
  const files = Object.fromEntries(Object.entries(themes).map(([folder, [id, version]]) => [`themes/${folder}/theme.json`, manifest(id, version)]));
  commit(repo, { "release/publishers.json": PUBLISHERS_JSON, ...files });
  return repo;
}

/** Clones `repo` as the pick job checks it out (all history and tags, origin/main), and runs the command there. */
function run(repo: string, args: readonly string[] = []): Ran {
  const clone = mkdtempSync(join(sandbox, "clone-"));
  git(sandbox, ["clone", "-q", pathToFileURL(repo).href, clone]);
  const ran = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: clone, env: GIT_ENV, encoding: "utf8" });
  const line = ran.stdout.trim();
  return { status: ran.status, themes: line === "" ? null : (JSON.parse(line) as Ran["themes"]), log: ran.stderr };
}

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe("the tag rule (scripts/release/themes.mjs)", () => {
  it("is <slug>-v<major>.<minor>.<patch>, the slug lower-case letters, digits and hyphens", () => {
    expect(TAG_PATTERN.source).toBe("^([a-z0-9-]+)-v\\d+\\.\\d+\\.\\d+$");
  });

  it.each<[string, { slug: string; version: string } | null]>([
    ["play-v1.2.1", { slug: "play", version: "1.2.1" }], ["arcade-v0.1.0", { slug: "arcade", version: "0.1.0" }],
    ["nav-vibe-v10.0.12", { slug: "nav-vibe", version: "10.0.12" }], ["3d-v1.0.0", { slug: "3d", version: "1.0.0" }],
    ["play-v1.2", null], ["play-v1.2.1-rc.1", null], ["v1.2.1", null], ["Play-v1.2.1", null], ["play_x-v1.2.1", null],
    ["play-1.2.1", null], ["play-v1.2.1\n", null], ["kit-b06-base", null],
  ])("parses %j as %j", (tag, expected) => {
    expect(parseTag(tag)).toEqual(expected);
  });
});

describe("the decisions", () => {
  it("identifies a listed publisher's theme in the folder its id names", () => {
    expect(identify("arcade", { id: "pixelcade/arcade", version: "0.1.1" }, PUBLISHERS)).toEqual({ theme: ARCADE });
  });

  it("leaves out a publisher release/publishers.json doesn't list", () => {
    expect(identify("harbour", { id: "acme/harbour", version: "1.0.0" }, PUBLISHERS))
      .toEqual({ skip: "acme/harbour: acme isn't in release/publishers.json, so it isn't published" });
  });

  it.each<[string, string, unknown]>([
    ["a folder that isn't the id's slug", "games", { id: "pixelcade/arcade", version: "0.1.1" }],
    ["a folder the tag rule can't name", "Arcade_1", { id: "pixelcade/arcade", version: "0.1.1" }],
    ["an id outside core's pattern", "arcade", { id: "Pixelcade/arcade", version: "0.1.1" }],
    ["an id with no publisher", "arcade", { id: "arcade", version: "0.1.1" }],
    ["a version with a leading zero", "arcade", { id: "pixelcade/arcade", version: "0.01.1" }],
    ["a version that isn't text", "arcade", { id: "pixelcade/arcade", version: 1 }],
    ["a theme.json that isn't an object", "arcade", ["pixelcade/arcade"]],
  ])("refuses %s, echoing nothing that failed its pattern", (_, folder, value) => {
    const named = identify(folder, value, PUBLISHERS);
    expect(named).toHaveProperty("error");
    expect(JSON.stringify(named)).not.toMatch(/Arcade_1|Pixelcade|0\.01\.1/);
  });

  it("picks a version above the newest tag, or one with no tag yet, by number, not as text", () => {
    const tag = (version: string) => ({ version, objectId: "0".repeat(40) });
    expect(decide(ARCADE, [])).toMatchObject({ pick: ARCADE });
    expect(decide(ARCADE, [tag("0.1.0"), tag("0.0.9")])).toMatchObject({ pick: ARCADE, message: "pixelcade/arcade 0.1.1 is above arcade-v0.1.0: picked" });
    expect(decide({ ...ARCADE, version: "0.10.0" }, [tag("0.9.0")])).toHaveProperty("pick");
    expect(decide(ARCADE, [tag("0.1.1")])).toEqual({ skip: "pixelcade/arcade 0.1.1 is released (arcade-v0.1.1)" });
    expect(decide(ARCADE, [tag("0.2.0")])).toEqual({ skip: "pixelcade/arcade 0.1.1 is not above the newest release, arcade-v0.2.0" });
  });

  it("names the folder, the tag and the package as pack names it", () => {
    expect(picked(ARCADE, "abc")).toEqual({
      ...ARCADE, dir: "themes/arcade", tag: "arcade-v0.1.1", packageName: "pixelcade.arcade", commit: "abc",
    });
  });

  it("reads the publishers list strictly", () => {
    expect(parsePublishers(PUBLISHERS_JSON)).toEqual(PUBLISHERS);
    ['{"publishers":["automatos","automatos"]}', '{"publishers":["Automatos"]}', '{"publishers":"automatos"}', "{"]
      .forEach((text) => expect(() => parsePublishers(text)).toThrow(/release\/publishers\.json/));
  });
});

describe("bumped.mjs at HEAD (a merge to main)", () => {
  it("picks each listed theme above its newest tag, at HEAD, and leaves the rest", () => {
    const repo = upstream({ arcade: ["pixelcade/arcade", "0.1.0"], hud: ["automatos/hud", "1.1.2"], harbour: ["acme/harbour", "2.0.0"] });
    git(repo, ["tag", "arcade-v0.1.0"]);
    git(repo, ["tag", "hud-v1.1.2"]);
    const head = commit(repo, { "themes/arcade/theme.json": manifest("pixelcade/arcade", "0.1.1") });
    const ran = run(repo);
    expect(ran.status, ran.log).toBe(EXIT_OK);
    expect(ran.themes).toEqual([picked(ARCADE, head)]);
    ["pixelcade/arcade 0.1.1 is above arcade-v0.1.0: picked", "acme/harbour: acme isn't in release/publishers.json",
      "automatos/hud 1.1.2 is released (hud-v1.1.2)"].forEach((line) => expect(ran.log).toContain(line));
  });

  it("picks nothing when no version moved, and says so per theme", () => {
    const repo = upstream({ play: ["automatos/play", "1.2.1"] });
    git(repo, ["tag", "play-v1.2.1"]);
    const ran = run(repo);
    expect([ran.status, ran.themes]).toEqual([EXIT_OK, []]);
    expect(ran.log).toContain("automatos/play 1.2.1 is released (play-v1.2.1)");
  });

  it("picks a theme with no release tag yet", () => {
    const repo = upstream({ arcade: ["pixelcade/arcade", "0.1.1"] });
    expect(run(repo).themes?.map((theme) => theme.tag)).toEqual(["arcade-v0.1.1"]);
  });

  it.each<[string, Readonly<Record<string, readonly [string, string]>>, RegExp]>([
    ["a folder that isn't its id's slug", { games: ["pixelcade/arcade", "0.1.1"] }, /themes\/games\/theme\.json's id is pixelcade\/arcade, so the theme must be in themes\/arcade/],
    ["a version outside core's pattern", { arcade: ["pixelcade/arcade", "0.1"] }, /themes\/arcade\/theme\.json's version must be MAJOR\.MINOR\.PATCH/],
  ])("refuses the whole run, picking nothing, for %s", (_, themes, error) => {
    const repo = upstream({ play: ["automatos/play", "9.0.0"], ...themes });
    const ran = run(repo);
    expect([ran.status, ran.themes]).toEqual([EXIT_REFUSED, null]);
    expect(ran.log).toMatch(new RegExp(`^::error::bumped: ${error.source}`, "m"));
  });

  it("refuses a run with no publishers list, and a usage error", () => {
    const repo = upstream({ play: ["automatos/play", "9.0.0"] });
    git(repo, ["rm", "-q", "release/publishers.json"]);
    git(repo, ["commit", "-q", "-m", "no list"]);
    const ran = run(repo);
    expect([ran.status, ran.themes]).toEqual([EXIT_REFUSED, null]);
    expect(ran.log).toContain("::error::bumped: can't read the publishers");
    expect(run(repo, ["play-v1.0.0"]).status).toBe(EXIT_USAGE);
  });
});

describe("bumped.mjs --tag (a backfill, and theme-release.yml's check)", () => {
  it("names the theme a tag on main names, at the tagged commit, whatever main holds now", () => {
    const repo = upstream({ hud: ["automatos/hud", "1.1.2"] });
    const tagged = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["tag", "-a", "hud-v1.1.2", "-m", "HUD 1.1.2"]);
    commit(repo, { "themes/hud/theme.json": manifest("automatos/hud", "1.2.0") });
    const ran = run(repo, ["--tag", "hud-v1.1.2"]);
    expect(ran.status, ran.log).toBe(EXIT_OK);
    expect(ran.themes).toEqual([picked({ slug: "hud", publisher: "automatos", id: "automatos/hud", version: "1.1.2" }, tagged)]);
  });

  it.each<[string, (repo: string) => string, RegExp]>([
    ["a tag that isn't on main", (repo) => {
      git(repo, ["checkout", "-q", "-b", "side"]);
      commit(repo, { "themes/hud/theme.json": manifest("automatos/hud", "1.1.3") });
      git(repo, ["tag", "hud-v1.1.3"]);
      git(repo, ["checkout", "-q", "main"]);
      return "hud-v1.1.3";
    }, /hud-v1\.1\.3 is not on main/],
    ["a tag that doesn't exist", () => "hud-v9.9.9", /there is no tag hud-v9\.9\.9 here/],
    ["a tag that doesn't name the version at it", (repo) => (git(repo, ["tag", "hud-v1.0.0"]), "hud-v1.0.0"), /hud-v1\.0\.0 does not name the version/],
    ["a tag for a publisher the list leaves out", (repo) => (git(repo, ["tag", "harbour-v2.0.0"]), "harbour-v2.0.0"), /harbour-v2\.0\.0 can't be released: acme\/harbour: acme isn't in/],
    ["a tag outside the rule, never echoed", () => "hud-v1.1.2\n::warning::x", /a release tag is <slug>-v<major>\.<minor>\.<patch>/],
  ])("refuses %s", (_, make, error) => {
    const repo = upstream({ hud: ["automatos/hud", "1.1.2"], harbour: ["acme/harbour", "2.0.0"] });
    const ran = run(repo, ["--tag", make(repo)]);
    expect([ran.status, ran.themes]).toEqual([EXIT_REFUSED, null]);
    expect(ran.log).toMatch(error);
    expect(ran.log).not.toContain("::warning::");
  });
});
