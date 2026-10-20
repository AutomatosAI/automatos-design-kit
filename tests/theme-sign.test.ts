// PRD-261 C-03a (D3-c): the kit's signing step. The signed text is byte for byte what core's
// signing.py `canonical_text` writes (Python json.dumps, sort_keys, no spaces, ensure_ascii); the
// expected strings below were written by that Python call. Keys are generated per test run: no key
// is stored in this public repo.
import { generateKeyPairSync, verify, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalBytes, canonicalJson, checkPayload, ID_PATTERN, isEchoSafe, parseRequest, VERSION_PATTERN } from "../scripts/sign/request.ts";
import { KEY_ENV, signedReport, signingKey, signRequest } from "../scripts/sign/sign.ts";
import { keyIdOf, parseEnvelope } from "../scripts/sign/envelope.ts";

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
/** sha256 of PYTHON_CANONICAL's ASCII bytes: the queue's payloadSha256. */
const PYTHON_PAYLOAD_SHA256 = "cf4484ebd29c236648120c026b75469c6a26da78211c9729cfe75daed9250023";
/** core's request_signature: requestId is str(uuid4()), kept beside the payload, not inside it. */
const REQUEST_ID = "5d3c9a5e-8f2b-4c1d-9e7a-0b1c2d3e4f50";
const WHOLE = { requestId: REQUEST_ID, payload: PAYLOAD, payloadSha256: PYTHON_PAYLOAD_SHA256, canonical: PYTHON_CANONICAL, algorithm: "ed25519" };
/** A PEM private key's armour label, built so that no file in this repo spells it out. */
const PEM_PRIVATE_LABEL = ["PRIVATE", "KEY"].join(" ");

/** A whole request with `payload` changed by `change`. */
function requestWith(change: Record<string, unknown>, outer: Record<string, unknown> = {}): string {
  return JSON.stringify({ requestId: REQUEST_ID, payload: { ...PAYLOAD, ...change }, ...outer });
}

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

describe("the request", () => {
  it("takes the whole request the queue shows, and checks its payloadSha256 and canonical text", () => {
    const parsed = parseRequest(JSON.stringify(WHOLE));
    expect(parsed.ok && parsed.value.requestId).toBe(REQUEST_ID);
    expect(parseRequest(JSON.stringify({ ...WHOLE, payloadSha256: "0".repeat(64) })).ok).toBe(false);
    expect(parseRequest(JSON.stringify({ ...WHOLE, canonical: `${PYTHON_CANONICAL} ` })).ok).toBe(false);
  });

  it("signs the payload alone, as core does: the request id is not in the signed text", () => {
    const parsed = parseRequest(JSON.stringify({ ...WHOLE, requestId: REQUEST_ID.toUpperCase() }));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.requestId).toBe(REQUEST_ID);
    expect(canonicalBytes(parsed.value.payload).toString("ascii")).toBe(PYTHON_CANONICAL);
  });

  it.each([
    ["not JSON", "{payload"],
    ["the payload alone, with no request id", JSON.stringify(PAYLOAD)],
    ["a request with no requestId", JSON.stringify({ payload: PAYLOAD })],
    ["a requestId that isn't a UUID", JSON.stringify({ ...WHOLE, requestId: "5d3c" })],
    ["a requestId carrying a workflow command", JSON.stringify({ ...WHOLE, requestId: `${REQUEST_ID}\n::add-mask::x` })],
    ["an extra key", requestWith({ signature: "x" })],
    ["a missing key", JSON.stringify({ requestId: REQUEST_ID, payload: { id: PAYLOAD.id, version: PAYLOAD.version, digest: PAYLOAD.digest } })],
    ["a digest the files don't add up to", requestWith({ digest: "1".repeat(64) })],
    ["a file without a sha256", requestWith({ files: { ...PAYLOAD.files, "README.md": "nope" } })],
    ["an empty id", requestWith({ id: "" })],
    ["an id outside core's pattern", requestWith({ id: "Automatos/Hello" })],
    ["an id with no publisher", requestWith({ id: "hello" })],
    ["an id carrying a workflow command", requestWith({ id: "a/b\n::add-mask::x" })],
    ["a version outside core's pattern", requestWith({ version: "1.0" })],
    ["a version with a leading zero", requestWith({ version: "01.0.0" })],
    ["a version carrying a workflow command", requestWith({ version: "1.0.0::stop-commands::x" })],
  ])("refuses %s", (_label, text) => {
    expect(parseRequest(text).ok).toBe(false);
  });

  it("holds id and version to core's manifest.py patterns", () => {
    expect(ID_PATTERN.source).toBe("^[a-z0-9][a-z0-9-]{0,38}\\/[a-z0-9][a-z0-9-]{0,62}$");
    expect(VERSION_PATTERN.source).toBe("^(0|[1-9][0-9]{0,5})\\.(0|[1-9][0-9]{0,5})\\.(0|[1-9][0-9]{0,5})$");
    expect(ID_PATTERN.test("automatos-e2e/hello")).toBe(true);
    expect(VERSION_PATTERN.test("10.0.123456")).toBe(true);
  });

  it("never echoes request text that could start a workflow command", () => {
    const keys = parseRequest(JSON.stringify({ requestId: REQUEST_ID, payload: { ...PAYLOAD, "x\n::add-mask::y": 1 } }));
    const path = parseRequest(requestWith({ files: { "a\u2028::error::b": "0".repeat(64) } }));
    [keys, path].forEach((parsed) => {
      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && isEchoSafe(parsed.error)).toBe(true);
    });
    expect(isEchoSafe("Theme: a/b 1.0.0")).toBe(true);
    expect(isEchoSafe("a\rb")).toBe(false);
    expect(isEchoSafe("a::b")).toBe(false);
  });

  it("refuses a payload that isn't an object", () => {
    expect(checkPayload([PAYLOAD]).ok).toBe(false);
  });
});

describe("signing", () => {
  it("refuses, signing nothing, when the secret is absent", () => {
    [undefined, "", "  \n"].forEach((pem) => {
      const result = signRequest(JSON.stringify(WHOLE), pem);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toContain(KEY_ENV);
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

  it("signs the canonical text with Ed25519: 64 bytes, verifiable with the public key", () => {
    const { pem, publicKey } = ed25519Pem();
    const result = signRequest(JSON.stringify({ requestId: REQUEST_ID, payload: PAYLOAD }), pem);
    if (!result.ok) throw new Error(result.error);
    const signature = Buffer.from(result.value.signature, "base64");
    expect(signature).toHaveLength(64);
    expect(verify(null, Buffer.from(PYTHON_CANONICAL, "ascii"), publicKey, signature)).toBe(true);
    expect(result.value.payloadSha256).toBe(PYTHON_PAYLOAD_SHA256);
    expect(result.value.requestId).toBe(REQUEST_ID);
    expect(result.value.publicKey).toBe(publicKey.export({ format: "der", type: "spki" }).toString("base64"));
  });

  it("prints the request id and the signature, never the key, on lines safe to echo", () => {
    const { pem } = ed25519Pem();
    const result = signRequest(JSON.stringify(WHOLE), pem);
    if (!result.ok) throw new Error(result.error);
    const lines = signedReport(result.value);
    expect(lines.every(isEchoSafe)).toBe(true);
    const printed = lines.join("\n");
    expect(printed).toContain(`Request id: ${REQUEST_ID}`);
    expect(printed).toContain(result.value.signature);
    expect(printed).not.toContain(PEM_PRIVATE_LABEL);
    expect(printed).not.toContain(pem.split("\n")[1]);
  });

  it("prints the key id: ed25519 and the first 16 hex of sha256 of the public key's SPKI DER", () => {
    const { pem, publicKey } = ed25519Pem();
    const result = signRequest(JSON.stringify(WHOLE), pem);
    if (!result.ok) throw new Error(result.error);
    const spki = publicKey.export({ format: "der", type: "spki" });
    expect(result.value.keyId).toBe(keyIdOf(spki));
    expect(result.value.keyId).toMatch(/^ed25519:[0-9a-f]{16}$/);
    expect(signedReport(result.value)).toContain(`Key id: ${result.value.keyId}`);
  });

  it("prints one echo-safe envelope line, the .sig.json that goes next to the package", () => {
    const { pem } = ed25519Pem();
    const result = signRequest(JSON.stringify(WHOLE), pem);
    if (!result.ok) throw new Error(result.error);
    const lines = signedReport(result.value);
    const envelopes = lines.filter((line) => line.startsWith("{"));
    expect(envelopes).toHaveLength(1);
    expect(lines.every(isEchoSafe)).toBe(true);
    const envelope = parseEnvelope(envelopes[0]);
    if (!envelope.ok) throw new Error(envelope.error);
    expect(envelope.value).toEqual({
      form: "automatos-theme-signature/v1", algorithm: "ed25519", keyId: result.value.keyId,
      id: PAYLOAD.id, version: PAYLOAD.version, digest: PAYLOAD.digest, signature: result.value.signature,
    });
    expect(lines[lines.indexOf(envelopes[0]) - 1]).toContain(`${PAYLOAD.version}.sig.json`);
  });
});
