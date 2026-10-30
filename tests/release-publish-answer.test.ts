// scripts/release/publish-answer.ts: the publish run's reading of the Marketplace's answer. Only a 200 that says
// published or unchanged for exactly this package lets the run release it; every other answer fails the run with
// the HTTP status, what it means and core's error code, and nothing from the answer is printed unless it is a code
// or plain, echo-safe text.
import { describe, expect, it } from "vitest";
import {
  ACCEPTED, EXIT_ACCEPTED, EXIT_REFUSED, EXIT_USAGE, errorCodes, MEANINGS, readAnswer, runPublishAnswer,
} from "../scripts/release/publish-answer.ts";

const EXPECTED = { id: "pixelcade/arcade", version: "0.1.0", digest: "a".repeat(64) };
const ok = (status: string, extra: Record<string, unknown> = {}): string => JSON.stringify({ status, ...EXPECTED, ...extra });

function ran(args: readonly string[], body = ""): { readonly code: number; readonly out: string[]; readonly err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const code = runPublishAnswer(args, { read: () => body, out: (line) => out.push(line), err: (line) => err.push(line) });
  return { code, out, err };
}

describe("readAnswer", () => {
  it.each(ACCEPTED)("accepts a 200 that says %s for this package", (status) => {
    expect(readAnswer("0", "200", ok(status), EXPECTED)).toEqual({ ok: true, status });
  });

  it.each<[string, string, string]>([
    ["another status", "200", ok("pending")],
    ["another version", "200", ok("published", { version: "0.1.1" })],
    ["another digest", "200", ok("published", { digest: "b".repeat(64) })],
    ["no JSON", "200", "published"],
  ])("refuses a 200 with %s", (_, status, body) => {
    expect(readAnswer("0", status, body, EXPECTED).ok).toBe(false);
  });

  it.each(["400", "401", "403", "409", "413", "422", "429", "503"])("refuses %s, saying what it means", (status) => {
    const answer = readAnswer("0", status, JSON.stringify({ detail: { code: "PUBLISH_NOT_CONFIGURED" } }), EXPECTED);
    expect(answer).toEqual({ ok: false, error: `The Marketplace answered ${status}: ${MEANINGS[status]} (PUBLISH_NOT_CONFIGURED). Nothing is released.` });
  });

  it("refuses an answer the contract does not give, and a run that never reached the Marketplace", () => {
    expect(readAnswer("0", "500", "", EXPECTED)).toMatchObject({ ok: false, error: expect.stringContaining("an answer the publish contract does not give") });
    expect(readAnswer("7", "000", "", EXPECTED)).toMatchObject({ ok: false, error: expect.stringContaining("could not be reached (curl exit 7)") });
  });
});

describe("errorCodes, from core's marketplace error shape", () => {
  it("reads detail.code and each detail.errors[].code, once each", () => {
    const body = JSON.stringify({ detail: { code: "SIGNATURE_BAD", message: "m", errors: [{ code: "SIGNATURE_BAD" }, { code: "SOURCE_REQUIRED", path: "source" }] } });
    expect(errorCodes(body)).toBe("SIGNATURE_BAD, SOURCE_REQUIRED");
  });

  it("reads the publish endpoint's own shape: detail.code, with the errors' codes after it", () => {
    const body = JSON.stringify({ detail: { code: "PACKAGE_REFUSED", message: "refused", errors: [{ code: "CSS_SCOPE", path: "dist/theme.css", message: "m" }] } });
    expect(errorCodes(body)).toBe("PACKAGE_REFUSED, CSS_SCOPE");
  });

  it("falls back to core's message as one safe line, and never prints a line break or a workflow command", () => {
    expect(errorCodes(JSON.stringify({ detail: "The Marketplace is off" }))).toBe("The Marketplace is off");
    const shown = errorCodes(JSON.stringify({ detail: { message: "bad\n::add-mask::x", errors: [{ code: "lower" }] } }));
    expect(shown).not.toMatch(/\n|::/);
    expect(errorCodes("<html>")).toBe("no error code in the answer");
  });
});

describe("the command", () => {
  it("prints status=<status> for $GITHUB_OUTPUT on an accepted answer", () => {
    const result = ran(["0", "200", "answer.json", EXPECTED.id, EXPECTED.version, EXPECTED.digest], ok("unchanged"));
    expect([result.code, result.out]).toEqual([EXIT_ACCEPTED, ["status=unchanged"]]);
  });

  it("prints one workflow error and nothing for $GITHUB_OUTPUT otherwise", () => {
    const result = ran(["0", "422", "answer.json", EXPECTED.id, EXPECTED.version, EXPECTED.digest], JSON.stringify({ detail: { code: "REVIEW_SUMMARY_BAD" } }));
    expect([result.code, result.out]).toEqual([EXIT_REFUSED, []]);
    expect(result.err).toEqual([expect.stringMatching(/^::error title=Not published::The Marketplace answered 422: .*\(REVIEW_SUMMARY_BAD\)/)]);
  });

  it("is a usage error without its six arguments", () => {
    expect(ran(["0", "200"]).code).toBe(EXIT_USAGE);
  });
});
