// PRD-261 C-03a (D3-c): the kit's signing step. The signed text is byte for byte what core's
// signing.py `canonical_text` writes (Python json.dumps, sort_keys, no spaces, ensure_ascii); the
// expected strings below were written by that Python call. Keys are generated per test run: no key
// is stored in this public repo.
import { generateKeyPairSync, verify, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalBytes, canonicalJson, checkPayload, parseRequest } from "../scripts/sign/request.ts";
import { KEY_ENV, signedReport, signingKey, signRequest } from "../scripts/sign/sign.ts";

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
  it("takes the payload alone", () => {
    const parsed = parseRequest(JSON.stringify(PAYLOAD));
    expect(parsed.ok && parsed.value.requestId).toBe(null);
  });

  it("takes the whole request the queue shows, and checks its payloadSha256 and canonical text", () => {
    const whole = { requestId: "5d3c", payload: PAYLOAD, payloadSha256: PYTHON_PAYLOAD_SHA256, canonical: PYTHON_CANONICAL, algorithm: "ed25519" };
    const parsed = parseRequest(JSON.stringify(whole));
    expect(parsed.ok && parsed.value.requestId).toBe("5d3c");
    expect(parseRequest(JSON.stringify({ ...whole, payloadSha256: "0".repeat(64) })).ok).toBe(false);
    expect(parseRequest(JSON.stringify({ ...whole, canonical: `${PYTHON_CANONICAL} ` })).ok).toBe(false);
  });

  it.each([
    ["not JSON", "{payload"],
    ["an extra key", JSON.stringify({ ...PAYLOAD, signature: "x" })],
    ["a missing key", JSON.stringify({ id: PAYLOAD.id, version: PAYLOAD.version, digest: PAYLOAD.digest })],
    ["a digest the files don't add up to", JSON.stringify({ ...PAYLOAD, digest: "1".repeat(64) })],
    ["a file without a sha256", JSON.stringify({ ...PAYLOAD, files: { ...PAYLOAD.files, "README.md": "nope" } })],
    ["an empty id", JSON.stringify({ ...PAYLOAD, id: "" })],
  ])("refuses %s", (_label, text) => {
    expect(parseRequest(text).ok).toBe(false);
  });

  it("refuses a payload that isn't an object", () => {
    expect(checkPayload([PAYLOAD]).ok).toBe(false);
  });
});

describe("signing", () => {
  it("refuses, signing nothing, when the secret is absent", () => {
    [undefined, "", "  \n"].forEach((pem) => {
      const result = signRequest(JSON.stringify(PAYLOAD), pem);
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
    const result = signRequest(JSON.stringify({ requestId: "r-1", payload: PAYLOAD }), pem);
    if (!result.ok) throw new Error(result.error);
    const signature = Buffer.from(result.value.signature, "base64");
    expect(signature).toHaveLength(64);
    expect(verify(null, Buffer.from(PYTHON_CANONICAL, "ascii"), publicKey, signature)).toBe(true);
    expect(result.value.payloadSha256).toBe(PYTHON_PAYLOAD_SHA256);
    expect(result.value.requestId).toBe("r-1");
    expect(result.value.publicKey).toBe(publicKey.export({ format: "der", type: "spki" }).toString("base64"));
  });

  it("prints the signature and never the key", () => {
    const { pem } = ed25519Pem();
    const result = signRequest(JSON.stringify(PAYLOAD), pem);
    if (!result.ok) throw new Error(result.error);
    const printed = signedReport(result.value).join("\n");
    expect(printed).toContain(result.value.signature);
    expect(printed).not.toContain("PRIVATE KEY");
    expect(printed).not.toContain(pem.split("\n")[1]);
  });
});
