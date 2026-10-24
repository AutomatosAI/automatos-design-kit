// PRD-261 B-02c: the harness's fixtures (packages/theme-harness/fixtures/**) are fake data in a public repo. Every
// JSON file parses, and no file there holds an e-mail address, a URL outside the reserved example hosts or localhost,
// a JWT-shaped string, or a key prefix (sk-, ak_srv_, ak_pub_, ghp_). The unit cases plant each kind of value, built
// at run time so this file holds none of them, and the scan must name it. Paths inside the app (/api/...,
// /deliverables?...) are not URLs. Play's tests (themes/play/test/**) are scanned the same way: they were moved from
// core, and hold recorded turns, Deliverables and links of their own.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURES = "packages/theme-harness/fixtures";
const PLAY_TESTS = "themes/play/test";
/** The folders the harness's fixtures live in (plan §2.6 B-02c), and the files a fake reads by name. */
const FOLDERS = ["streams", "deliverables", "cards", "health", "errors", "conversations"];
const NAMED_FILES = ["README.md", "health/up.json", "health/down.json", "errors/404.json"];
/**
 * The hosts a scanned file's URL may name (and their subdomains). Beside example.com and localhost, Play's tests use
 * example.org and the top-level names example and invalid: RFC 2606 reserves all of them, so none is a real site.
 */
const ALLOWED_HOSTS = ["example.com", "localhost", "example.org", "example", "invalid"];
/**
 * Text that looks like a URL but names no host, each exactly as it stands: in Play's tests, a malformed source the
 * Deliverable reader must keep as text (test/lib/detail.test.ts), and core's absolute link with its host left out
 * (test/moved-from-core/chat.json).
 */
const NOT_URLS = ["http://[bad", "https://.../deliverables?tab=outputs&deliverable=d-7"];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const URL_LIKE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>`)\]]+/gi;
const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*|\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const KEY_PREFIX = /(?<![A-Za-z0-9])(?:sk-|ak_srv_|ak_pub_|ghp_)[A-Za-z0-9]/g;

/** Every file under one scanned folder of the repo, relative to it. */
function filesUnder(rel: string): string[] {
  const folder = join(ROOT, rel);
  return readdirSync(folder, { encoding: "utf8", recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort();
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function allowedUrl(url: string): boolean {
  if (NOT_URLS.includes(url)) return true;
  const host = hostOf(url);
  return host !== null && ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

const found = (pattern: RegExp, text: string): string[] => Array.from(text.matchAll(pattern), (match) => match[0]);

/** What in `text` is not fake data, each named by its kind. */
function realDataIn(text: string): string[] {
  return [
    ...found(EMAIL, text).map((value) => `e-mail: ${value}`),
    ...found(URL_LIKE, text).filter((url) => !allowedUrl(url)).map((value) => `URL: ${value}`),
    ...found(JWT_SHAPE, text).map((value) => `JWT shape: ${value}`),
    ...found(KEY_PREFIX, text).map((value) => `key prefix: ${value}`),
  ];
}

// Planted values, joined at run time so no literal one sits in this file.
const PLANTED = {
  email: ["someone", "mail.test"].join("@"),
  url: ["https:", "", "api.other-host.test", "v1"].join("/"),
  jwt: ["eyJ" + "hbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJlLXBhcnQ"].join("."),
  dottedToken: ["abcdefghij0123", "klmnopqrst4567", "uvwxyzABCD8901"].join("."),
  /** Each prefix as a key starts, and the key it starts. */
  keys: ["sk-", "ak_srv_", "ak_pub_", "ghp_"].map((start) => [start, `${start}A1b2C3d4`] as const),
};

describe("the fake-data check", () => {
  it("names a planted e-mail, a URL outside the allowed hosts, a JWT shape and each key prefix", () => {
    expect(realDataIn(`"owner": "${PLANTED.email}"`)).toEqual([`e-mail: ${PLANTED.email}`]);
    expect(realDataIn(`"link": "${PLANTED.url}"`)).toEqual([`URL: ${PLANTED.url}`]);
    expect(realDataIn(`"token": "${PLANTED.jwt}"`)).toEqual([`JWT shape: ${PLANTED.jwt}`]);
    expect(realDataIn(`"token": "${PLANTED.dottedToken}"`)).toEqual([`JWT shape: ${PLANTED.dottedToken}`]);
    PLANTED.keys.forEach(([start, key]) => {
      expect(realDataIn(`"key": "${key}"`)).toEqual([`key prefix: ${start}A`]);
    });
  });

  it("passes fake data: the allowed hosts, app paths, ids that merely contain a prefix's letters", () => {
    const clean = [
      '"preview_url": "https://cdn.example.com/a.png"',
      '"backend": "http://localhost:8000/health"',
      '"content_url": "/api/workspaces/ws-harness/files/content?path=outputs%2Fa.md"',
      '"title": "Compare laptops", "id": "task-card", "key": "desk-lamp"',
      '"file": "outputs/climate-debate.pptx", "version": "1.1.0"',
      '"src": "https://evil.example/c.png", "base": "http://play.invalid", "url": "https://ratings.example.org/x"',
      ...NOT_URLS.map((text) => `"source": "${text}"`),
    ].join("\n");
    expect(realDataIn(clean)).toEqual([]);
  });
});

describe("packages/theme-harness/fixtures", () => {
  const files = filesUnder(FIXTURES);

  it("has the folders and the files the fakes read", () => {
    FOLDERS.forEach((folder) => expect(files.some((file) => file.startsWith(`${folder}/`))).toBe(true));
    expect(files).toEqual(expect.arrayContaining(NAMED_FILES));
  });

  it.each(files.filter((file) => file.endsWith(".json")))("%s parses", (file) => {
    expect(() => JSON.parse(readFileSync(join(ROOT, FIXTURES, file), "utf8"))).not.toThrow();
  });

  it.each(files)("%s holds fake data only", (file) => {
    expect(realDataIn(readFileSync(join(ROOT, FIXTURES, file), "utf8"))).toEqual([]);
  });
});

describe("themes/play/test", () => {
  const files = filesUnder(PLAY_TESTS);

  it("has Play's tests and the test-move ledger", () => {
    expect(files).toEqual(expect.arrayContaining(["manifest.test.ts", "moved-from-core/chat.json"]));
  });

  it.each(files)("%s holds fake data only", (file) => {
    expect(realDataIn(readFileSync(join(ROOT, PLAY_TESTS, file), "utf8"))).toEqual([]);
  });
});
