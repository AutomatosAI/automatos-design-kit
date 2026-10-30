// scripts/sign/from-pack.ts, the publish run's signer: the signing payload made from pack's own .sha256.json, held to
// the package's bytes before anything is signed. The payload's canonical text must be core's
// canonical_text(signing_payload(package)) byte for byte: the shared vector (tests/fixtures/signing-vector.json, the
// same bytes as core's orchestrator/tests/fixtures/themes/signing-vector.json) proves it. Real packages come from
// pack itself, run on theme-cli's hello fixture; the only private keys are the vector's RFC 8032 seeds, in memory.
import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { PACK_MANIFEST_SCHEMA, packTheme } from "../packages/theme-cli/src/pack.ts";
import { sha256Hex } from "../packages/theme-cli/src/digest.ts";
import { writeZip, readZip } from "../packages/theme-cli/src/zip.ts";
import { parseEnvelope } from "../scripts/sign/envelope.ts";
import {
  checkPack, EXIT_DONE, EXIT_REFUSED, EXIT_USAGE, PACK_SUMMARY_SCHEMA, readSummary, runFromPack, signPack, type FromPackIo,
} from "../scripts/sign/from-pack.ts";
import { canonicalBytes, isEchoSafe } from "../scripts/sign/request.ts";
import { KEY_ENV } from "../scripts/sign/sign.ts";
import { verifyPackage } from "../scripts/sign/verify.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HELLO = join(ROOT, "packages/theme-cli/test/fixtures/core/hello");
/** The fixed DER prefix of an Ed25519 private key (PKCS#8, RFC 8410). */
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const PEM_PRIVATE_LABEL = ["PRIVATE", "KEY"].join(" ");

interface RfcCase { readonly seed: string; readonly public: string; readonly spki: string; readonly keyId: string }
interface CanonicalCase { readonly value: { id: string; version: string; digest: string; files: Record<string, string> }; readonly text: string; readonly sha256: string }
const VECTOR = JSON.parse(readFileSync(join(ROOT, "tests/fixtures/signing-vector.json"), "utf8")) as {
  readonly ed25519: { readonly cases: readonly RfcCase[] };
  readonly canonical: { readonly cases: readonly CanonicalCase[] };
};
const [SIGNER] = VECTOR.ed25519.cases;
const SIGNING_PAYLOAD = VECTOR.canonical.cases[0];
const pem = (rfc: RfcCase): string =>
  createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, Buffer.from(rfc.seed, "hex")]), format: "der", type: "pkcs8" })
    .export({ format: "pem", type: "pkcs8" }).toString();
const keysText = (rfc: RfcCase): string => JSON.stringify({ schema: 1, keys: [{ keyId: rfc.keyId, spki: rfc.spki, status: "active", added: "2026-10-20" }] });

const sandbox = mkdtempSync(join(tmpdir(), "from-pack-"));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

/** The hello fixture packed by pack itself: its .autotheme bytes and its .sha256.json text. */
function packedHello(): { readonly bytes: Buffer; readonly summary: string } {
  const root = join(mkdtempSync(join(sandbox, "theme-")), "hello");
  cpSync(HELLO, root, { recursive: true });
  const result = packTheme(root, mkdtempSync(join(sandbox, "out-")));
  if (!result.ok) throw new Error(result.errors.map((error) => error.code).join(", "));
  return { bytes: readFileSync(result.file), summary: readFileSync(result.manifestFile, "utf8") };
}

/** pack's summary for the vector's signing payload: each file a {type, size, sha256} row, as pack writes them. */
function vectorSummary(): string {
  const { id, version, digest, files } = SIGNING_PAYLOAD.value;
  const rows = Object.fromEntries(Object.entries(files).map(([path, sha256]) => [path, { type: "text/plain", size: 1, sha256 }]));
  return JSON.stringify({ schema: PACK_SUMMARY_SCHEMA, id, version, digest, zipSha256: "0".repeat(64), files: rows }, null, 2);
}

const summaryWith = (text: string, change: Record<string, unknown>): string => JSON.stringify({ ...JSON.parse(text), ...change });

function io(files: Readonly<Record<string, Buffer | string>>): FromPackIo & { readonly lines: string[]; readonly errors: string[]; readonly written: Record<string, string> } {
  const lines: string[] = [];
  const errors: string[] = [];
  const written: Record<string, string> = {};
  return {
    lines, errors, written,
    read: (path) => {
      if (!(path in files)) throw new Error("no such file");
      return Buffer.from(files[path]);
    },
    write: (path, text) => { written[path] = text; },
    out: (line) => lines.push(line),
    err: (line) => errors.push(line),
  };
}

describe("the payload from pack's summary is core's signing payload", () => {
  it("reads pack's own summary schema", () => {
    expect(PACK_SUMMARY_SCHEMA).toBe(PACK_MANIFEST_SCHEMA);
  });

  it("gives the shared vector's signing payload, whose canonical text is core's byte for byte", () => {
    const summary = readSummary(vectorSummary());
    if (!summary.ok) throw new Error(summary.error);
    expect(summary.value.payload).toEqual(SIGNING_PAYLOAD.value);
    const bytes = canonicalBytes(summary.value.payload);
    expect(bytes.toString("ascii")).toBe(SIGNING_PAYLOAD.text);
    expect(sha256Hex(bytes)).toBe(SIGNING_PAYLOAD.sha256);
  });

  it.each<[string, (text: string) => string]>([
    ["text that isn't JSON", () => "{"],
    ["another schema", (text) => summaryWith(text, { schema: "automatos-theme-pack/v2" })],
    ["no zipSha256", (text) => summaryWith(text, { zipSha256: "x" })],
    ["a file row with no sha256", (text) => summaryWith(text, { files: { "theme.json": { type: "application/json", size: 1 } } })],
    ["a digest the files don't add up to", (text) => summaryWith(text, { digest: "1".repeat(64) })],
    ["an id outside core's pattern", (text) => summaryWith(text, { id: "Pixelcade/arcade" })],
  ])("refuses a summary with %s", (_, change) => {
    const summary = readSummary(change(vectorSummary()));
    expect(summary.ok).toBe(false);
    expect(!summary.ok && isEchoSafe(summary.error)).toBe(true);
  });
});

describe("a package is checked against its summary before it is signed", () => {
  const { bytes, summary } = packedHello();

  it("takes the bytes pack wrote, with the payload their own members give", () => {
    const checked = checkPack(bytes, summary);
    expect(checked.ok && checked.value.digest).toBe(JSON.parse(summary).digest);
  });

  it("refuses bytes whose sha256 isn't the summary's zipSha256", () => {
    const other = Buffer.concat([bytes, Buffer.from([0])]);
    expect(checkPack(other, summary)).toMatchObject({ ok: false, error: expect.stringContaining("zipSha256") });
  });

  it("refuses a package whose members differ from the summary, even with its zipSha256 changed to match", () => {
    const entries = readZip(bytes).map((entry) => (entry.path === "dist/entry.js" ? { path: entry.path, data: Buffer.from("export {};\n") } : entry));
    const changed = writeZip(entries);
    const result = checkPack(changed, summaryWith(summary, { zipSha256: sha256Hex(changed) }));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("differ from its pack summary") });
  });

  it("signs only a checked package, and the envelope verifies against it with the keys file", () => {
    expect(signPack(Buffer.from("not a zip"), summary, pem(SIGNER)).ok).toBe(false);
    const signed = signPack(bytes, summary, pem(SIGNER));
    if (!signed.ok) throw new Error(signed.error);
    expect(verifyPackage({ packageBytes: bytes, envelopeText: JSON.stringify(signed.value.envelope), keysText: keysText(SIGNER) }))
      .toEqual({ state: "verified", keyId: SIGNER.keyId });
    const publicKey = createPublicKey({ key: Buffer.from(SIGNER.spki, "base64"), format: "der", type: "spki" });
    const checked = checkPack(bytes, summary);
    if (!checked.ok) throw new Error(checked.error);
    expect(verify(null, canonicalBytes(checked.value), publicKey, Buffer.from(signed.value.signature, "base64"))).toBe(true);
  });
});

describe("the command", () => {
  const { bytes, summary } = packedHello();
  const files = { "pkg.autotheme": bytes, "pkg.sha256.json": summary };

  it("check: prints the checked theme on one safe line, and reads no key", () => {
    const stub = io(files);
    expect(runFromPack(["check", "pkg.autotheme", "pkg.sha256.json"], {}, stub)).toBe(EXIT_DONE);
    expect(stub.lines).toEqual([`Checked: automatos-e2e/hello 1.0.0, digest ${JSON.parse(summary).digest}, ${Object.keys(JSON.parse(summary).files).length} files`]);
  });

  it("sign: writes the one-line envelope, removes the key from its environment and prints the key id, never the key", () => {
    const stub = io(files);
    const env: Record<string, string> = { [KEY_ENV]: pem(SIGNER) };
    expect(runFromPack(["sign", "pkg.autotheme", "pkg.sha256.json", "1.0.0.sig.json"], env, stub)).toBe(EXIT_DONE);
    expect(env).toEqual({});
    const text = stub.written["1.0.0.sig.json"];
    expect(text.endsWith("}\n") && text.split("\n").length).toBe(2);
    const envelope = parseEnvelope(text);
    expect(envelope.ok && envelope.value.keyId).toBe(SIGNER.keyId);
    expect(stub.lines).toContain(`Key id: ${SIGNER.keyId}`);
    const printed = [...stub.lines, ...stub.errors].join("\n");
    [PEM_PRIVATE_LABEL, pem(SIGNER).split("\n")[1]].forEach((secret) => expect(printed).not.toContain(secret));
  });

  it.each<[string, readonly string[], Record<string, string>, Readonly<Record<string, Buffer | string>>, RegExp]>([
    ["no key", ["sign", "pkg.autotheme", "pkg.sha256.json", "out.sig.json"], {}, files, /THEME_SIGNING_KEY secret is not set/],
    ["a package that isn't its summary's", ["sign", "pkg.autotheme", "pkg.sha256.json", "out.sig.json"], {},
      { ...files, "pkg.autotheme": Buffer.concat([bytes, Buffer.from([1])]) }, /zipSha256/],
    ["a missing file", ["check", "pkg.autotheme", "none.sha256.json"], {}, files, /Can't read the package or its pack summary/],
  ])("refuses %s with one workflow error, writing nothing", (_, args, env, given, reason) => {
    const stub = io(given);
    expect(runFromPack(args, env, stub)).toBe(EXIT_REFUSED);
    expect(stub.errors).toHaveLength(1);
    expect(stub.errors[0]).toMatch(/^::error title=Not signed::/);
    expect(stub.errors[0]).toMatch(reason);
    expect(stub.written).toEqual({});
  });

  it("is a usage error for anything but check with two files or sign with three", () => {
    [[], ["check", "a"], ["sign", "a", "b"], ["verify", "a", "b"]].forEach((args) => expect(runFromPack(args, {}, io(files))).toBe(EXIT_USAGE));
  });
});
