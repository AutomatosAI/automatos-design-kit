// theme-publish.yml's bash steps, run as the runner's bash runs them, with stand-ins for gh, git and curl on the PATH
// that record what they were asked and answer as the case needs: the check of a downloaded package, the compare with
// an existing release (a backfill never replaces released bytes), the POST to the Marketplace (the key on stdin, never
// on a command line), the release on core's answer, and the build's check of the review's text. Nothing reaches the
// network. The workflow's shape is tests/theme-publish.test.ts.
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sha256Hex } from "../packages/theme-cli/src/digest.ts";
import { packTheme } from "../packages/theme-cli/src/pack.ts";
import { ROOT, envOf, jobOf, readText, stepNamed, stepsOf } from "./support/workflow-steps.ts";

const PUBLISH = ".github/workflows/theme-publish.yml";
const text = readText(PUBLISH);
const publish = stepsOf(jobOf(text, "publish"));
const build = stepsOf(jobOf(text, "build"));
const WORKFLOW_ENV = Object.fromEntries(["PACK_FOLDER", "KEYS_FILE", "PUBLISH_PATH", "REVIEW_IMAGE"].map((name) => [name, envOf(text, name)]));
const THEME = { THEME_ID: "pixelcade/arcade", VERSION: "0.1.0", TAG: "arcade-v0.1.0", PACKAGE_NAME: "pixelcade.arcade", COMMIT: "c".repeat(40) };
const PACKAGE_FILE = `${THEME.PACKAGE_NAME}-${THEME.VERSION}.autotheme`;
const KEY = "k".repeat(64);
const DIGEST = "d".repeat(64);
const STANDINS: Readonly<Record<string, string>> = {
  gh: [
    'printf "gh %s\\n" "$*" >> "$FAKE_LOG"',
    'if [ "$1" = api ]; then',
    '  if [ -n "${FAKE_API_ERROR:-}" ]; then printf "%s\\n" "$FAKE_API_ERROR" >&2; exit 1; fi',
    '  printf "%s\\n" ${FAKE_ASSETS:-}; exit 0',
    "fi",
    'if [ "$1 $2" = "release download" ]; then',
    "  shift 3",
    '  while [ $# -gt 0 ]; do case "$1" in --pattern) pattern="$2"; shift 2;; --dir) dir="$2"; shift 2;; *) shift;; esac; done',
    '  mkdir -p "$dir"; cp "$FAKE_RELEASED/$pattern" "$dir/$pattern"',
    "fi",
  ].join("\n"),
  git: ['printf "git %s\\n" "$*" >> "$FAKE_LOG"', 'if [ -n "${FAKE_TAGGED:-}" ]; then printf "%s\\trefs/tags/%s\\n" "$FAKE_TAGGED" "$TAG"; fi'].join("\n"),
  curl: [
    'printf "%s\\n" "$@" > "$FAKE_CURL_ARGS"',
    'cat > "$FAKE_CURL_STDIN"',
    'while [ $# -gt 0 ]; do if [ "$1" = --output ]; then out="$2"; fi; shift; done',
    'printf "%s" "${FAKE_BODY:-}" > "$out"',
    'printf "%s" "${FAKE_CODE:-200}"',
    'exit "${FAKE_CURL_EXIT:-0}"',
  ].join("\n"),
};

const sandbox = mkdtempSync(join(tmpdir(), "theme-publish-steps-"));
const bin = join(sandbox, "bin");
mkdirSync(bin);
Object.entries(STANDINS).forEach(([name, body]) => {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\nexit 0\n`);
  chmodSync(join(bin, name), 0o755);
});
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

interface Ran {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly written: Readonly<Record<string, string>>;
  readonly output: string;
  /** Each call to a stand-in gh or git, as "gh <args>" or "git <args>". */
  readonly calls: readonly string[];
  readonly temp: string;
}

const lines = (file: string): string[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter((line) => line !== "") : []);

/** A fresh RUNNER_TEMP, with `files` written under it (path relative to it). */
function runnerTemp(files: Readonly<Record<string, string | Buffer>> = {}): string {
  const temp = mkdtempSync(join(sandbox, "temp-"));
  Object.entries(files).forEach(([rel, body]) => {
    mkdirSync(dirname(join(temp, rel)), { recursive: true });
    writeFileSync(join(temp, rel), body);
  });
  return temp;
}

/** The step's script as the runner's bash runs it, at the kit's root, the stand-ins first on the PATH. */
function runStep(script: string, env: Readonly<Record<string, string>>, temp: string = runnerTemp()): Ran {
  const [githubEnv, githubOutput, log] = ["github-env", "github-output", "calls.log"].map((name) => join(temp, name));
  [githubEnv, githubOutput].forEach((file) => writeFileSync(file, ""));
  const run = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd: ROOT, encoding: "utf8",
    env: {
      PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH ?? ""}`, HOME: sandbox, ...WORKFLOW_ENV, ...THEME,
      RUNNER_TEMP: temp, GITHUB_ENV: githubEnv, GITHUB_OUTPUT: githubOutput, GH_REPO: "AutomatosAI/automatos-design-kit", FAKE_LOG: log,
      FAKE_CURL_ARGS: join(temp, "curl-args"), FAKE_CURL_STDIN: join(temp, "curl-stdin"), ...env,
    },
  });
  const written = Object.fromEntries(lines(githubEnv).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, written, output: readFileSync(githubOutput, "utf8"), calls: lines(log), temp };
}

describe("Check the package against its summary", () => {
  const packed = (() => {
    const root = join(mkdtempSync(join(sandbox, "theme-")), "hello");
    cpSync(join(ROOT, "packages/theme-cli/test/fixtures/core/hello"), root, { recursive: true });
    const result = packTheme(root, mkdtempSync(join(sandbox, "out-")));
    if (!result.ok) throw new Error(result.errors.map((error) => error.code).join(", "));
    return { bytes: readFileSync(result.file), summary: readFileSync(result.manifestFile, "utf8"), base: "automatos-e2e.hello-1.0.0" };
  })();
  const hello = { THEME_ID: "automatos-e2e/hello", VERSION: "1.0.0", PACKAGE_NAME: "automatos-e2e.hello" };
  const downloaded = (sha256: string = sha256Hex(packed.bytes)): string => runnerTemp({
    [`publish/${packed.base}.autotheme`]: packed.bytes, [`publish/${packed.base}.sha256.json`]: packed.summary,
    [`publish/${packed.base}.autotheme.sha256`]: `${sha256}  ${packed.base}.autotheme\n`,
  });

  it("names the files the later steps use once the bytes are pack's, for the theme picked", () => {
    const ran = runStep(stepNamed(publish, "Check the package against its summary").run, hello, downloaded());
    expect(ran.status, ran.stderr + ran.stdout).toBe(0);
    expect(ran.written).toEqual({
      PACKAGE: `${ran.temp}/publish/${packed.base}.autotheme`, SUMMARY: `${ran.temp}/publish/${packed.base}.sha256.json`,
      REVIEW: `${ran.temp}/publish/review.txt`, ENVELOPE: `${ran.temp}/publish/1.0.0.sig.json`,
      PACKAGE_SHA256: sha256Hex(packed.bytes), PACKAGE_DIGEST: JSON.parse(packed.summary).digest,
    });
  });

  it.each<[string, Readonly<Record<string, string>>, string | undefined, RegExp]>([
    ["a .sha256 that isn't the bytes'", hello, "0".repeat(64), /sha256 differs from its summary or its \.sha256/],
    ["a package that isn't the theme picked", { ...hello, THEME_ID: "automatos-e2e/other" }, undefined, /isn't automatos-e2e\/other 1\.0\.0, the theme picked/],
  ])("refuses %s, naming nothing for the later steps", (_, env, sha256, error) => {
    const ran = runStep(stepNamed(publish, "Check the package against its summary").run, env, downloaded(sha256));
    expect([ran.status, ran.written]).toEqual([1, {}]);
    expect(ran.stdout).toMatch(error);
  });
});

describe("Find the release", () => {
  const find = stepNamed(publish, "Find the release").run;
  const released = (body: string): string => runnerTemp({ [`released-assets/${PACKAGE_FILE}`]: body });
  const NOT_FOUND = { FAKE_API_ERROR: "gh: Not Found (HTTP 404)" };

  it("finds no release and no tag: the release is made later", () => {
    const ran = runStep(find, { ...NOT_FOUND, PACKAGE_SHA256: DIGEST });
    expect([ran.status, ran.written]).toEqual([0, { RELEASE: "none", RELEASE_SIGNED: "false" }]);
    expect(ran.calls[0]).toBe(`gh api repos/AutomatosAI/automatos-design-kit/releases/tags/${THEME.TAG} --jq .assets[].name`);
  });

  it("takes a tag with no release only at the commit built", () => {
    expect(runStep(find, { ...NOT_FOUND, PACKAGE_SHA256: DIGEST, FAKE_TAGGED: THEME.COMMIT }).written.RELEASE).toBe("none");
    const other = runStep(find, { ...NOT_FOUND, PACKAGE_SHA256: DIGEST, FAKE_TAGGED: "e".repeat(40) });
    expect([other.status, other.written]).toEqual([1, {}]);
    expect(other.stdout).toMatch(/^::error::arcade-v0\.1\.0 is at another commit than the one built/m);
  });

  it("fails when the release can't be read, rather than take it for none", () => {
    const ran = runStep(find, { FAKE_API_ERROR: "gh: Bad credentials (HTTP 401)", PACKAGE_SHA256: DIGEST });
    expect([ran.status, ran.written]).toEqual([1, {}]);
    expect(ran.stdout).toMatch(/^::error::Can't read the arcade-v0\.1\.0 release/m);
  });

  it.each<[string, string, string]>([
    ["no signature yet", `${PACKAGE_FILE} ${PACKAGE_FILE}.sha256`, "false"],
    ["its signature already", `${PACKAGE_FILE} ${PACKAGE_FILE}.sha256 0.1.0.sig.json`, "true"],
  ])("takes an existing release whose package is the bytes rebuilt here, with %s", (_, assets, signed) => {
    const temp = released("the released bytes");
    const ran = runStep(find, { FAKE_ASSETS: assets, FAKE_RELEASED: join(temp, "released-assets"), PACKAGE_SHA256: sha256Hex("the released bytes") }, temp);
    expect([ran.status, ran.written]).toEqual([0, { RELEASE: "existing", RELEASE_SIGNED: signed }]);
  });

  it("refuses a backfill whose rebuilt bytes aren't the released ones: nothing is published or replaced", () => {
    const temp = released("the released bytes");
    const ran = runStep(find, { FAKE_ASSETS: PACKAGE_FILE, FAKE_RELEASED: join(temp, "released-assets"), PACKAGE_SHA256: sha256Hex("other bytes") }, temp);
    expect([ran.status, ran.written]).toEqual([1, {}]);
    expect(ran.stdout).toMatch(/^::error::The arcade-v0\.1\.0 release holds other bytes than the ones rebuilt here/m);
  });
});

describe("Publish to the Marketplace", () => {
  const post = stepNamed(publish, "Publish to the Marketplace").run;
  const parts = (): Readonly<Record<string, string>> => {
    const temp = runnerTemp({ "publish/pkg.autotheme": "zip", "publish/0.1.0.sig.json": "{}\n", "publish/review.txt": "Outcome: pass\n" });
    return { PACKAGE: `${temp}/publish/pkg.autotheme`, ENVELOPE: `${temp}/publish/0.1.0.sig.json`, REVIEW: `${temp}/publish/review.txt`, temp };
  };
  const answer = (status: string): string => JSON.stringify({ status, id: THEME.THEME_ID, version: THEME.VERSION, digest: DIGEST });
  const sending = (env: Readonly<Record<string, string>> = {}): Ran => {
    const { temp, ...files } = parts();
    return runStep(post, { ...files, PACKAGE_DIGEST: DIGEST, THEME_PUBLISH_KEY: KEY, THEME_PUBLISH_API_URL: "https://core.example.test/", ...env }, temp);
  };

  it("posts the three parts to the endpoint, the key on curl's stdin only, and hands core's status on", () => {
    const ran = sending({ FAKE_CODE: "200", FAKE_BODY: answer("published") });
    expect(ran.status, ran.stderr).toBe(0);
    expect(ran.output).toBe("status=published\n");
    const args = lines(join(ran.temp, "curl-args"));
    expect(args).toContain("https://core.example.test/api/marketplace/themes/publish");
    expect(args).toEqual(expect.arrayContaining(["--header", "@-", "--proto", "=https", `package=@${ran.temp}/publish/pkg.autotheme;type=application/octet-stream;filename=${PACKAGE_FILE}`,
      `signature=<${ran.temp}/publish/0.1.0.sig.json`, `review_summary=<${ran.temp}/publish/review.txt`]));
    expect(readFileSync(join(ran.temp, "curl-stdin"), "utf8")).toBe(`Authorization: Bearer ${KEY}\n`);
    [args.join("\n"), ran.stdout, ran.stderr, ran.output].forEach((shown) => expect(shown).not.toContain(KEY));
  });

  it.each<[string, Readonly<Record<string, string>>, RegExp]>([
    ["a refusal", { FAKE_CODE: "422", FAKE_BODY: JSON.stringify({ detail: { code: "SIGNATURE_BAD" } }) }, /The Marketplace answered 422: .*\(SIGNATURE_BAD\)/],
    ["a Marketplace it can't reach", { FAKE_CURL_EXIT: "7", FAKE_CODE: "000" }, /could not be reached \(curl exit 7\)/],
  ])("fails on %s, with nothing for the release step", (_, env, error) => {
    const ran = sending(env);
    expect([ran.status, ran.output]).toEqual([1, ""]);
    expect(ran.stderr).toMatch(error);
    expect(`${ran.stdout}${ran.stderr}`).not.toContain(KEY);
  });

  it.each<[string, Readonly<Record<string, string>>, RegExp]>([
    ["no address", { THEME_PUBLISH_API_URL: "" }, /THEME_PUBLISH_API_URL variable must be the core API's https:\/\/ address/],
    ["an address that isn't https", { THEME_PUBLISH_API_URL: "http://core.example.test" }, /THEME_PUBLISH_API_URL variable must be/],
    ["no key", { THEME_PUBLISH_KEY: "" }, /has no THEME_PUBLISH_KEY secret/],
  ])("sends nothing with %s", (_, env, error) => {
    const ran = sending(env);
    expect([ran.status, ran.output, existsSync(join(ran.temp, "curl-args"))]).toEqual([1, "", false]);
    expect(ran.stdout).toMatch(error);
  });
});

describe("Release", () => {
  const release = stepNamed(publish, "Release").run;
  const releasing = (env: Readonly<Record<string, string>>, existing = "{\"same\":true}\n"): Ran => {
    const temp = runnerTemp({
      "publish/release-title.txt": "Arcade 0.1.0", "publish/release-notes.md": "Arcade 0.1.0. Notes.\n",
      "publish/0.1.0.sig.json": "{\"same\":true}\n", "released-assets/0.1.0.sig.json": existing,
    });
    const files = { PACKAGE: `${temp}/publish/${PACKAGE_FILE}`, ENVELOPE: `${temp}/publish/0.1.0.sig.json`, FAKE_RELEASED: `${temp}/released-assets` };
    return runStep(release, { ...files, ...env }, temp);
  };

  it.each(["published", "unchanged"])("makes the release on %s when the tag has none: the package, its .sha256 and its .sig.json", (status) => {
    const ran = releasing({ PUBLISHED: status, RELEASE: "none", RELEASE_SIGNED: "false" });
    const pkg = `${ran.temp}/publish/${PACKAGE_FILE}`;
    expect(ran.status, ran.stderr).toBe(0);
    expect(ran.calls).toEqual([`gh release create ${THEME.TAG} ${pkg} ${pkg}.sha256 ${ran.temp}/publish/0.1.0.sig.json --target ${THEME.COMMIT} --title Arcade 0.1.0 --notes-file ${ran.temp}/publish/release-notes.md`]);
  });

  it("adds only the .sig.json to a release the tag has, never replacing an asset", () => {
    const ran = releasing({ PUBLISHED: "published", RELEASE: "existing", RELEASE_SIGNED: "false" });
    expect([ran.status, ran.calls]).toEqual([0, [`gh release upload ${THEME.TAG} ${ran.temp}/publish/0.1.0.sig.json`]]);
  });

  it("leaves a release that carries this signature as it is, and fails on one that carries another", () => {
    const same = releasing({ PUBLISHED: "unchanged", RELEASE: "existing", RELEASE_SIGNED: "true" });
    expect([same.status, same.calls.filter((call) => /release (?:create|upload)/.test(call))]).toEqual([0, []]);
    const other = releasing({ PUBLISHED: "unchanged", RELEASE: "existing", RELEASE_SIGNED: "true" }, "{\"other\":true}\n");
    expect(other.status).toBe(1);
    expect(other.stdout).toMatch(/^::error::The arcade-v0\.1\.0 release carries another 0\.1\.0\.sig\.json; it is left as it is/m);
  });

  it.each(["", "rejected"])("releases nothing on any other answer (%j)", (status) => {
    const ran = releasing({ PUBLISHED: status, RELEASE: "none", RELEASE_SIGNED: "false" });
    expect([ran.status, ran.calls]).toEqual([1, []]);
  });
});

describe("Check the review (the build)", () => {
  const check = stepNamed(build, "Check the review").run;
  const reviewed = (body: string): Ran => runStep(check, { PACKAGE_DIGEST: DIGEST }, runnerTemp({ "review/summary.txt": body }));
  const header = (outcome: string, digest = DIGEST): string => `Automatos theme review (1): ${THEME.THEME_ID} 0.1.0\nOutcome: ${outcome}\nPackage digest:  ${digest}\n`;

  it("takes a review that names this digest with Outcome: pass", () => {
    expect(reviewed(header("pass")).status).toBe(0);
  });

  it.each<[string, string]>([
    ["a failed review", header("fail")],
    ["another package's digest", header("pass", "e".repeat(64))],
    ["an outcome only inside a check's items", `${header("fail")}Checks:\n    - Outcome: pass\n`],
  ])("refuses %s, so nothing is published", (_, body) => {
    const ran = reviewed(body);
    expect(ran.status).toBe(1);
    expect(ran.stdout).toMatch(/^::error::The review's text doesn't name/m);
  });
});
