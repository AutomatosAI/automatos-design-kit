// PRD-261 C-05m: the kit's signature check. The Ed25519 cases and the canonical text come from
// tests/fixtures/signing-vector.json, which core copies byte for byte (C-05a). The only private keys
// used are the RFC 8032 seeds of that file, wrapped as PKCS#8 DER here, in memory: no private key is
// stored in this public repo. keys/theme-signing.json holds a public key only: Automatos's
// theme-signing key, which no RFC seed signs for.
import { spawnSync } from "node:child_process";
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../packages/theme-cli/src/digest.ts";
import { writeZip } from "../packages/theme-cli/src/zip.ts";
import { ENVELOPE_MAX_BYTES, envelopeText, keyIdOf, makeEnvelope, parseEnvelope, type Envelope } from "../scripts/sign/envelope.ts";
import { canonicalJson, checkPayload, isEchoSafe } from "../scripts/sign/request.ts";
import { signPayload } from "../scripts/sign/sign.ts";
import {
  DEFAULT_KEYS_PATH, EXIT_NOT_VERIFIED, EXIT_USAGE, EXIT_VERIFIED, packagePayload, parseKeys, runVerify,
  verifyEnvelope, verifyPackage, type Verdict,
} from "../scripts/sign/verify.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VECTOR_PATH = join(ROOT, "tests/fixtures/signing-vector.json");
/** Automatos's theme-signing key: the one key keys/theme-signing.json ships (core's signing-keys.json, the same bytes). */
const SHIPPED_KEY_ID = "ed25519:e138b6d0fa7aaaf3";
const SHIPPED_SPKI = "MCowBQYDK2VwAyEA8/ZN550R8owJj73irzwwUlZzYplIx/Ki5D9NXSrgEXU=";
const SHIPPED_KEYS = `{"schema":1,"keys":[{"keyId":"${SHIPPED_KEY_ID}","spki":"${SHIPPED_SPKI}","status":"active","added":"2026-10-26"}]}\n`;
/** A keys file with no key: nothing verifies against it. */
const NO_KEYS = '{"schema":1,"keys":[]}\n';
/** The fixed DER prefixes of an Ed25519 public key (SPKI) and private key (PKCS#8, RFC 8410). */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const THEME = { id: "automatos-e2e/hello", version: "1.0.0" };
const ADDED = "2026-10-20";

interface RfcCase {
  readonly name: string;
  /** The RFC's SECRET KEY: the 32-byte seed. */
  readonly seed: string;
  /** The RFC's PUBLIC KEY. */
  readonly public: string;
  readonly message: string;
  readonly signature: string;
  readonly spki: string;
  readonly keyId: string;
}

interface CanonicalCase {
  readonly name: string;
  readonly value: Parameters<typeof canonicalJson>[0];
  readonly text: string;
  readonly sha256: string;
}

const VECTOR = JSON.parse(readFileSync(VECTOR_PATH, "utf8")) as {
  readonly ed25519: { readonly source: string; readonly cases: readonly RfcCase[] };
  readonly canonical: { readonly cases: readonly CanonicalCase[] };
};
const RFC = VECTOR.ed25519.cases;
const [SIGNER, OTHER] = RFC;
const RFC_ROWS = RFC.map((rfc): [string, RfcCase] => [rfc.name, rfc]);
const CANONICAL_ROWS = VECTOR.canonical.cases.map((item): [string, CanonicalCase] => [item.name, item]);

const hex = (text: string): Buffer => Buffer.from(text, "hex");

function publicKeyOf(rfc: RfcCase): KeyObject {
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, hex(rfc.public)]), format: "der", type: "spki" });
}

function privateKeyOf(rfc: RfcCase): KeyObject {
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, hex(rfc.seed)]), format: "der", type: "pkcs8" });
}

/** The RFC seed as the PEM text the sign step reads from its secret; made here, never written to disk. */
function pemOf(rfc: RfcCase): string {
  return privateKeyOf(rfc).export({ format: "pem", type: "pkcs8" }).toString();
}

function keysText(status: string, rfc: RfcCase = SIGNER, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ schema: 1, keys: [{ keyId: rfc.keyId, spki: rfc.spki, status, added: ADDED, ...extra }] });
}

function themePackage(theme: { id: string; version: string } = THEME, entry = "export {};\n"): Buffer {
  return writeZip([
    { path: "theme.json", data: Buffer.from(JSON.stringify({ schema: "automatos-theme/v1", ...theme })) },
    { path: "dist/entry.js", data: Buffer.from(entry) },
  ]);
}

/** The envelope the sign step prints for `pkg`, signed with an RFC seed. */
function signedEnvelope(pkg: Buffer, rfc: RfcCase = SIGNER): Envelope {
  const payload = packagePayload(pkg);
  if (!payload.ok) throw new Error(payload.error);
  const signed = signPayload(payload.value, pemOf(rfc));
  if (!signed.ok) throw new Error(signed.error);
  return signed.value.envelope;
}

function reasonOf(verdict: Verdict): string {
  if (verdict.state !== "invalid") throw new Error(`expected invalid, got ${verdict.state}`);
  expect(isEchoSafe(verdict.reason)).toBe(true);
  return verdict.reason;
}

function check(pkg: Buffer, envelope: Envelope | string, keys = keysText("active")): Verdict {
  const text = typeof envelope === "string" ? envelope : envelopeText(envelope);
  return verifyPackage({ packageBytes: pkg, envelopeText: text, keysText: keys });
}

describe("the shared vector: RFC 8032 section 7.1 and the canonical text", () => {
  it("cites the RFC section and holds its five Ed25519 cases", () => {
    expect(VECTOR.ed25519.source).toContain("RFC 8032 section 7.1");
    expect(RFC.map((rfc) => rfc.name)).toEqual(["TEST 1", "TEST 2", "TEST 3", "TEST 1024", "TEST SHA(abc)"]);
    expect(readFileSync(VECTOR_PATH, "utf8").endsWith("}\n")).toBe(true);
  });

  it.each(RFC_ROWS)("%s: the RFC signature verifies, a flipped byte does not", (_name, rfc) => {
    const signature = hex(rfc.signature);
    expect(verify(null, hex(rfc.message), publicKeyOf(rfc), signature)).toBe(true);
    const flipped = Buffer.from(signature);
    flipped[flipped.length - 1] ^= 1;
    expect(verify(null, hex(rfc.message), publicKeyOf(rfc), flipped)).toBe(false);
  });

  it.each(RFC_ROWS)("%s: the seed wrapped as PKCS#8 DER gives the RFC's public key and signature", (_name, rfc) => {
    const spki = createPublicKey(privateKeyOf(rfc)).export({ format: "der", type: "spki" });
    expect(spki.toString("hex")).toBe(`${SPKI_PREFIX.toString("hex")}${rfc.public}`);
    expect(sign(null, hex(rfc.message), privateKeyOf(rfc)).toString("hex")).toBe(rfc.signature);
  });

  it.each(RFC_ROWS)("%s: spki and keyId are derived from the public key", (_name, rfc) => {
    const spki = Buffer.concat([SPKI_PREFIX, hex(rfc.public)]);
    expect(spki.toString("base64")).toBe(rfc.spki);
    expect(keyIdOf(spki)).toBe(`ed25519:${sha256Hex(spki).slice(0, 16)}`);
    expect(keyIdOf(spki)).toBe(rfc.keyId);
  });

  it.each(CANONICAL_ROWS)("%s: the kit's canonical text equals the vector's", (_name, item) => {
    expect(canonicalJson(item.value)).toBe(item.text);
    expect(sha256Hex(Buffer.from(item.text, "ascii"))).toBe(item.sha256);
  });

  it("the canonical signing payload is one core would sign, and its text round-trips with an RFC seed", () => {
    const { value, text, sha256 } = VECTOR.canonical.cases[0];
    const checked = checkPayload(value);
    if (!checked.ok) throw new Error(checked.error);
    const signed = signPayload(checked.value, pemOf(SIGNER));
    if (!signed.ok) throw new Error(signed.error);
    expect(verify(null, Buffer.from(text, "ascii"), publicKeyOf(SIGNER), Buffer.from(signed.value.signature, "base64"))).toBe(true);
    expect([signed.value.keyId, signed.value.payloadSha256]).toEqual([SIGNER.keyId, sha256]);
  });
});

describe("verify: an envelope against its package and the keys file", () => {
  const pkg = themePackage();
  const envelope = signedEnvelope(pkg);

  it("verifies a sign-then-verify round trip with an RFC seed", () => {
    expect(check(pkg, envelope)).toEqual({ state: "verified", keyId: SIGNER.keyId });
    expect(envelope).toMatchObject({ form: "automatos-theme-signature/v1", algorithm: "ed25519", keyId: SIGNER.keyId, ...THEME });
  });

  it("refuses a package whose bytes changed: a digest mismatch", () => {
    expect(reasonOf(check(themePackage(THEME, "export const changed = 1;\n"), envelope))).toMatch(/digest .* differs/);
  });

  it("refuses an envelope for another version of the theme", () => {
    expect(reasonOf(check(themePackage({ ...THEME, version: "1.0.1" }), envelope))).toMatch(/is for automatos-e2e\/hello 1\.0\.0, but the package is automatos-e2e\/hello 1\.0\.1/);
  });

  it("refuses an envelope whose signature was changed", () => {
    const bytes = Buffer.from(envelope.signature, "base64");
    bytes[0] ^= 1;
    expect(reasonOf(check(pkg, { ...envelope, signature: bytes.toString("base64") }))).toMatch(/doesn't verify/);
  });

  it("refuses a signature made by another key under the signer's key id", () => {
    const forged = { ...signedEnvelope(pkg, OTHER), keyId: SIGNER.keyId };
    expect(reasonOf(check(pkg, forged))).toMatch(/doesn't verify/);
  });

  it("refuses an unknown key, a revoked key and a retired key", () => {
    expect(reasonOf(check(pkg, envelope, keysText("active", OTHER)))).toMatch(/isn't in the keys file/);
    expect(reasonOf(check(pkg, envelope, keysText("revoked")))).toMatch(/is revoked/);
    expect(reasonOf(check(pkg, envelope, keysText("retired")))).toMatch(/is retired/);
  });

  it("is unsigned with no envelope", () => {
    const payload = packagePayload(pkg);
    const keys = parseKeys(keysText("active"));
    if (!payload.ok || !keys.ok) throw new Error("fixture");
    expect(verifyEnvelope(payload.value, null, keys.value)).toEqual({ state: "unsigned" });
  });

  it("builds the payload from the package: theme.json's id and version, every member's sha256", () => {
    const payload = packagePayload(pkg);
    expect(payload.ok && payload.value).toMatchObject({ ...THEME, digest: envelope.digest });
    expect(payload.ok && Object.keys(payload.value.files).sort()).toEqual(["dist/entry.js", "theme.json"]);
    expect(reasonOf(check(Buffer.from("not a zip"), envelope))).toMatch(/isn't a zip/);
    const bare = writeZip([{ path: "dist/entry.js", data: Buffer.from("export {};\n") }]);
    expect(reasonOf(check(bare, envelope))).toMatch(/has no theme\.json/);
  });
});

describe("the keys file", () => {
  it("ships Automatos's theme-signing key: one active Ed25519 key, its keyId derived from its spki", () => {
    expect(readFileSync(DEFAULT_KEYS_PATH, "utf8")).toBe(SHIPPED_KEYS);
    expect(readFileSync(join(ROOT, "keys/theme-signing.json"), "utf8")).toBe(SHIPPED_KEYS);
    const keys = parseKeys(SHIPPED_KEYS);
    if (!keys.ok) throw new Error(keys.error);
    expect(keys.value.map((key) => [key.keyId, key.status, key.publicKey.asymmetricKeyType])).toEqual([[SHIPPED_KEY_ID, "active", "ed25519"]]);
    const der = Buffer.from(SHIPPED_SPKI, "base64");
    expect(der.subarray(0, SPKI_PREFIX.length).toString("hex")).toBe(SPKI_PREFIX.toString("hex"));
    expect(keyIdOf(der)).toBe(SHIPPED_KEY_ID);
  });

  it("verifies no envelope the shipped key didn't sign: an RFC seed's isn't in the keys file", () => {
    const pkg = themePackage();
    expect(RFC.map((rfc) => rfc.keyId)).not.toContain(SHIPPED_KEY_ID);
    expect(reasonOf(check(pkg, signedEnvelope(pkg), SHIPPED_KEYS))).toMatch(/isn't in the keys file/);
  });

  it("verifies nothing with no key", () => {
    const keys = parseKeys(NO_KEYS);
    expect(keys.ok && keys.value).toEqual([]);
    const pkg = themePackage();
    expect(reasonOf(check(pkg, signedEnvelope(pkg), NO_KEYS))).toMatch(/isn't in the keys file/);
  });

  it("takes a well-formed key of each status", () => {
    ["active", "retired", "revoked"].forEach((status) => expect(parseKeys(keysText(status)).ok).toBe(true));
  });

  const { publicKey: ecKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const ecSpki = ecKey.export({ format: "der", type: "spki" });
  const pair = (rfc: RfcCase) => ({ keyId: rfc.keyId, spki: rfc.spki, status: "active", added: ADDED });

  it.each([
    ["not JSON", "{schema"],
    ["another schema", JSON.stringify({ schema: 2, keys: [] })],
    ["keys that aren't a list", JSON.stringify({ schema: 1, keys: {} })],
    ["an extra field", keysText("active", SIGNER, { note: "x" })],
    ["an unknown status", keysText("paused")],
    ["no added date", JSON.stringify({ schema: 1, keys: [{ ...pair(SIGNER), added: "20 Oct" }] })],
    ["an spki that isn't base64", JSON.stringify({ schema: 1, keys: [{ ...pair(SIGNER), spki: "not base64!" }] })],
    ["an spki that isn't a key", JSON.stringify({ schema: 1, keys: [{ ...pair(SIGNER), spki: "AAAA" }] })],
    ["a key that isn't Ed25519", JSON.stringify({ schema: 1, keys: [{ ...pair(SIGNER), spki: ecSpki.toString("base64"), keyId: keyIdOf(ecSpki) }] })],
    ["a keyId that doesn't match its spki", JSON.stringify({ schema: 1, keys: [{ ...pair(SIGNER), keyId: OTHER.keyId }] })],
    ["the same key twice", JSON.stringify({ schema: 1, keys: [pair(SIGNER), { ...pair(SIGNER), status: "retired" }] })],
  ])("refuses %s, with a plain reason", (_label, text) => {
    const keys = parseKeys(text);
    expect(keys.ok).toBe(false);
    expect(!keys.ok && isEchoSafe(keys.error)).toBe(true);
  });
});

describe("the envelope", () => {
  const pkg = themePackage();
  const envelope = signedEnvelope(pkg);
  const fields = { ...envelope } as Record<string, unknown>;
  const text = (change: Record<string, unknown>): string => JSON.stringify({ ...fields, ...change });

  it("is one line of JSON with exactly the contract's fields, read back unchanged", () => {
    const line = envelopeText(envelope);
    expect(isEchoSafe(line)).toBe(true);
    expect(Object.keys(JSON.parse(line))).toEqual(["form", "algorithm", "keyId", "id", "version", "digest", "signature"]);
    expect(parseEnvelope(line)).toEqual({ ok: true, value: envelope });
    expect(makeEnvelope(envelope)).toEqual(envelope);
  });

  it.each([
    ["larger than 4 KB", `${envelopeText(envelope)}${" ".repeat(ENVELOPE_MAX_BYTES)}`],
    ["not JSON", "{form"],
    ["a list", JSON.stringify([fields])],
    ["an extra key", text({ files: {} })],
    ["a missing key", JSON.stringify({ ...fields, keyId: undefined })],
    ["another form", text({ form: "automatos-theme-signature/v2" })],
    ["another algorithm", text({ algorithm: "rsa" })],
    ["a keyId of the wrong shape", text({ keyId: "ed25519:ABC" })],
    ["an id carrying a workflow command", text({ id: "a/b\n::add-mask::x" })],
    ["a version outside core's pattern", text({ version: "1.0" })],
    ["a digest that isn't hex", text({ digest: "z".repeat(64) })],
    ["a signature that isn't 64 bytes", text({ signature: Buffer.alloc(63).toString("base64") })],
    ["a signature in url-safe base64", text({ signature: Buffer.alloc(64, 0xfb).toString("base64url") })],
  ])("refuses an envelope that is %s, echoing nothing", (_label, value) => {
    const parsed = parseEnvelope(value);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && isEchoSafe(parsed.error)).toBe(true);
    expect(reasonOf(check(pkg, value))).toBe(!parsed.ok && parsed.error);
  });
});

describe("the verify command", () => {
  const pkg = themePackage();
  const dir = mkdtempSync(join(tmpdir(), "theme-verify-"));
  const paths = { pkg: join(dir, "hello.autotheme"), sig: join(dir, "1.0.0.sig.json"), keys: join(dir, "keys.json") };
  writeFileSync(paths.pkg, pkg);
  writeFileSync(paths.sig, `${envelopeText(signedEnvelope(pkg))}\n`);
  writeFileSync(paths.keys, keysText("active"));
  const revokedKeys = join(dir, "revoked.json");
  writeFileSync(revokedKeys, keysText("revoked"));
  const changedPkg = join(dir, "changed.autotheme");
  writeFileSync(changedPkg, themePackage(THEME, "export const changed = 1;\n"));

  function run(args: readonly string[]): { code: number; out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    const code = runVerify(args, { read: (path) => readFileSync(path), out: (line) => out.push(line), err: (line) => err.push(line) });
    return { code, out, err };
  }

  it("exits 0 and names the key when the envelope verifies", () => {
    const result = run([paths.pkg, paths.sig, paths.keys]);
    expect(result.code).toBe(EXIT_VERIFIED);
    expect(result.out).toEqual([`Verified: signed by ${SIGNER.keyId}.`]);
  });

  it("exits 1 with one plain reason when it doesn't, and 2 for a usage error", () => {
    const unknown = run([paths.pkg, paths.sig]);
    expect(unknown.code).toBe(EXIT_NOT_VERIFIED);
    expect(unknown.err).toHaveLength(1);
    expect(unknown.err[0]).toMatch(/^Not verified: The envelope's key ed25519:[0-9a-f]{16} isn't in the keys file/);
    expect(run([paths.pkg, paths.sig, revokedKeys])).toMatchObject({ code: EXIT_NOT_VERIFIED, err: [expect.stringMatching(/is revoked/)] });
    expect(run([changedPkg, paths.sig, paths.keys])).toMatchObject({ code: EXIT_NOT_VERIFIED, err: [expect.stringMatching(/digest .* differs/)] });
    expect(run([paths.pkg, join(dir, "missing.sig.json"), paths.keys]).err[0]).toMatch(/^Not verified: Can't read /);
    expect(run([paths.pkg]).code).toBe(EXIT_USAGE);
  });

  it("runs as a script with Node: exit 1 on the shipped keys, exit 0 on a keys file holding the signer", () => {
    const script = join(ROOT, "scripts/sign/verify.ts");
    const shipped = spawnSync(process.execPath, [script, paths.pkg, paths.sig], { encoding: "utf8", cwd: ROOT });
    expect(shipped.status).toBe(EXIT_NOT_VERIFIED);
    expect(shipped.stderr).toContain("isn't in the keys file");
    const held = spawnSync(process.execPath, [script, paths.pkg, paths.sig, paths.keys], { encoding: "utf8", cwd: ROOT });
    expect(held.status).toBe(EXIT_VERIFIED);
    expect(held.stdout).toContain(`Verified: signed by ${SIGNER.keyId}.`);
  });
});
