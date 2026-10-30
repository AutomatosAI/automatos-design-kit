// PRD-261 C-03a (D3-c): the kit's signing step, now the publish run's (scripts/sign/sign.ts, called by from-pack.ts).
// The signed text is byte for byte what core's signing.py `canonical_text` writes (Python json.dumps, sort_keys, no
// spaces, ensure_ascii); the expected strings below were written by that Python call. Keys are generated per test
// run: no private key is stored in this public repo. Nothing signs a pasted request any more: the payload is checked
// as core builds it, then signed.
import { generateKeyPairSync, verify, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalBytes, canonicalJson, checkPayload, ID_PATTERN, isEchoSafe, VERSION_PATTERN } from "../scripts/sign/request.ts";
import { KEY_ENV, signedReport, signingKey, signPayload } from "../scripts/sign/sign.ts";
import { keyIdOf, parseEnvelope } from "../scripts/sign/envelope.ts";
import { readText } from "./support/workflow-steps.ts";

const PAYLOAD = {
  version: "1.0.0",
  id: "automatos-e2e/hello",
  files: {
    "theme.json": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    "dist/entry.js": "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d",
    "looks/schema.json": "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6",
  },
  digest: "00371a2da369586d414681cf279f8058bffab9423cbdf71cf93372cd60dfc9d4",
};
/** python3: json.dumps(PAYLOAD, sort_keys=True, separators=(",", ":"), ensure_ascii=True) */
const PYTHON_CANONICAL =
  '{"digest":"00371a2da369586d414681cf279f8058bffab9423cbdf71cf93372cd60dfc9d4","files":{"dist/entry.js":"3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d","looks/schema.json":"2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6","theme.json":"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"},"id":"automatos-e2e/hello","version":"1.0.0"}';
/** sha256 of PYTHON_CANONICAL's ASCII bytes. */
const PYTHON_PAYLOAD_SHA256 = "cf4484ebd29c236648120c026b75469c6a26da78211c9729cfe75daed9250023";
/** A PEM private key's armour label, built so that no file in this repo spells it out. */
const PEM_PRIVATE_LABEL = ["PRIVATE", "KEY"].join(" ");

const payloadWith = (change: Record<string, unknown>): unknown => ({ ...PAYLOAD, ...change });

function ed25519Pem(): { pem: string; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { pem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(), publicKey };
}

describe("canonical JSON (core's canonical_text)", () => {
  it("matches Python for the signing payload", () => {
    expect(canonicalJson(PAYLOAD)).toBe(PYTHON_CANONICAL);
    expect(canonicalBytes(PAYLOAD).toString("ascii")).toBe(PYTHON_CANONICAL);
  });

  it("escapes as ensure_ascii does: non-ASCII, DEL, controls, quotes, surrogate pairs", () => {
    const value = { b: 'é\u007f\n"\\ \u0001/', a: ["😀", true, null, { z: "\u2028", y: "" }] };
    // python3: json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    expect(canonicalJson(value)).toBe('{"a":["\\ud83d\\ude00",true,null,{"y":"","z":"\\u2028"}],"b":"\\u00e9\\u007f\\n\\"\\\\ \\u0001/"}');
  });
});

describe("the payload, checked as core builds it", () => {
  it("takes a payload whose file hashes add up to its digest", () => {
    expect(checkPayload(PAYLOAD)).toEqual({ ok: true, value: PAYLOAD });
  });

  it.each([
    ["an extra key", payloadWith({ signature: "x" })],
    ["a missing key", { id: PAYLOAD.id, version: PAYLOAD.version, digest: PAYLOAD.digest }],
    ["a digest the files don't add up to", payloadWith({ digest: "1".repeat(64) })],
    ["a file without a sha256", payloadWith({ files: { ...PAYLOAD.files, "README.md": "nope" } })],
    ["no files", payloadWith({ files: {} })],
    ["an empty id", payloadWith({ id: "" })],
    ["an id outside core's pattern", payloadWith({ id: "Automatos/Hello" })],
    ["an id with no publisher", payloadWith({ id: "hello" })],
    ["an id carrying a workflow command", payloadWith({ id: "a/b\n::add-mask::x" })],
    ["a version outside core's pattern", payloadWith({ version: "1.0" })],
    ["a version with a leading zero", payloadWith({ version: "01.0.0" })],
    ["a version carrying a workflow command", payloadWith({ version: "1.0.0::stop-commands::x" })],
    ["a payload that isn't an object", [PAYLOAD]],
  ])("refuses %s", (_label, value) => {
    expect(checkPayload(value).ok).toBe(false);
  });

  it("holds id and version to core's manifest.py patterns", () => {
    expect(ID_PATTERN.source).toBe("^[a-z0-9][a-z0-9-]{0,38}\\/[a-z0-9][a-z0-9-]{0,62}$");
    expect(VERSION_PATTERN.source).toBe("^(0|[1-9][0-9]{0,5})\\.(0|[1-9][0-9]{0,5})\\.(0|[1-9][0-9]{0,5})$");
    expect(ID_PATTERN.test("automatos-e2e/hello")).toBe(true);
    expect(VERSION_PATTERN.test("10.0.123456")).toBe(true);
  });

  it("never echoes payload text that could start a workflow command", () => {
    const keys = checkPayload({ ...PAYLOAD, "x\n::add-mask::y": 1 });
    const path = checkPayload(payloadWith({ files: { "a\u2028::error::b": "0".repeat(64) } }));
    [keys, path].forEach((parsed) => {
      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && isEchoSafe(parsed.error)).toBe(true);
    });
    expect(isEchoSafe("Theme: a/b 1.0.0")).toBe(true);
    expect(isEchoSafe("a\rb")).toBe(false);
    expect(isEchoSafe("a::b")).toBe(false);
  });
});

describe("signing", () => {
  it("refuses, signing nothing, when the secret is absent", () => {
    [undefined, "", "  \n"].forEach((pem) => {
      const result = signPayload(PAYLOAD, pem);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain(KEY_ENV);
      expect(!result.ok && result.error).toContain("theme-publish environment");
    });
  });

  it("refuses a key that isn't a PEM private key, without echoing it", () => {
    const result = signingKey("not a key at all");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).not.toContain("not a key at all");
  });

  it("refuses a key that isn't Ed25519", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const result = signingKey(privateKey.export({ format: "pem", type: "pkcs8" }).toString());
    expect(!result.ok && result.error).toMatch(/is a ec key/);
  });

  it("refuses a payload core would not sign, with the key at hand", () => {
    const { pem } = ed25519Pem();
    expect(signPayload({ ...PAYLOAD, digest: "1".repeat(64) }, pem).ok).toBe(false);
  });

  it("signs the canonical text with Ed25519: 64 bytes, verifiable with the public key", () => {
    const { pem, publicKey } = ed25519Pem();
    const result = signPayload(PAYLOAD, pem);
    if (!result.ok) throw new Error(result.error);
    const signature = Buffer.from(result.value.signature, "base64");
    expect(signature).toHaveLength(64);
    expect(verify(null, Buffer.from(PYTHON_CANONICAL, "ascii"), publicKey, signature)).toBe(true);
    expect(result.value.payloadSha256).toBe(PYTHON_PAYLOAD_SHA256);
    expect(result.value.publicKey).toBe(publicKey.export({ format: "der", type: "spki" }).toString("base64"));
  });

  it("names the key: ed25519 and the first 16 hex of sha256 of the public key's SPKI DER", () => {
    const { pem, publicKey } = ed25519Pem();
    const result = signPayload(PAYLOAD, pem);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.keyId).toBe(keyIdOf(publicKey.export({ format: "der", type: "spki" })));
    expect(result.value.keyId).toMatch(/^ed25519:[0-9a-f]{16}$/);
  });

  it("makes the envelope, the .sig.json that goes next to the package", () => {
    const { pem } = ed25519Pem();
    const result = signPayload(PAYLOAD, pem);
    if (!result.ok) throw new Error(result.error);
    const envelope = parseEnvelope(JSON.stringify(result.value.envelope));
    if (!envelope.ok) throw new Error(envelope.error);
    expect(envelope.value).toEqual({
      form: "automatos-theme-signature/v1", algorithm: "ed25519", keyId: result.value.keyId,
      id: PAYLOAD.id, version: PAYLOAD.version, digest: PAYLOAD.digest, signature: result.value.signature,
    });
  });

  it("reports the theme, the digest and the key id on lines safe to echo, never the key or the signature", () => {
    const { pem } = ed25519Pem();
    const result = signPayload(PAYLOAD, pem);
    if (!result.ok) throw new Error(result.error);
    const lines = signedReport(result.value);
    expect(lines.every(isEchoSafe)).toBe(true);
    const printed = lines.join("\n");
    [`Signed: ${PAYLOAD.id} ${PAYLOAD.version}`, `Digest: ${PAYLOAD.digest}`, `Key id: ${result.value.keyId}`].forEach((line) => expect(lines).toContain(line));
    [PEM_PRIVATE_LABEL, pem.split("\n")[1], result.value.signature].forEach((secret) => expect(printed).not.toContain(secret));
  });

  it("says verifying exists (C-05m): sign.ts points at verify.ts", () => {
    const sign = readText("scripts/sign/sign.ts");
    expect(sign).not.toMatch(/Verifying signatures is (?:PRD-261 )?C-05|nothing verifies them yet/);
    expect(sign).toContain("verify.ts");
  });
});
