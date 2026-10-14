// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatRatio, hexToTriplet, normaliseColour, tripletContrast, tripletToHex } from "@/lib/skins/colour";
import { sniffType } from "@/lib/skins/sniff";
import { MP4_BYTES, PNG_BYTES, TEXT_BYTES, WEBM_BYTES, WOFF2_BYTES } from "./helpers";

describe("skin colours", () => {
  it("normalises #rrggbb to an HSL triplet, either case", () => {
    expect(hexToTriplet("#C44A1A")).toBe("16.9 76.6% 43.5%");
    expect(normaliseColour("#c44a1a")).toBe("16.9 76.6% 43.5%");
    expect(normaliseColour("#FFFFFF")).toBe("0 0% 100%");
    expect(normaliseColour("#000000")).toBe("0 0% 0%");
    expect(normaliseColour("#1A1814")).toBe("40 13% 9%");
  });

  it("keeps triplets, without trailing zeros", () => {
    expect(normaliseColour("16 100% 50%")).toBe("16 100% 50%");
    expect(normaliseColour("16.50 100.00% 50.5%")).toBe("16.5 100% 50.5%");
  });

  it("refuses anything else", () => {
    for (const value of ["#FFF", "16 100% 50", "16,100%,50%", " 16 100% 50%", "16  100% 50%", 16, null, undefined]) {
      expect(normaliseColour(value)).toBeNull();
    }
  });

  it("turns a triplet back into the colour a browser draws", () => {
    expect(tripletToHex("16 100% 50%")).toBe("#FF4400");
    expect(tripletToHex("0 0% 100%")).toBe("#FFFFFF");
    expect(tripletToHex(hexToTriplet("#3D6FD6"))).toBe("#3D6FD6");
  });

  it("measures contrast both ways round and prints it rounded down", () => {
    expect(tripletContrast("0 0% 0%", "0 0% 100%")).toBeCloseTo(21, 5);
    expect(tripletContrast("0 0% 98%", "16 100% 50%")).toBeCloseTo(tripletContrast("16 100% 50%", "0 0% 98%"), 10);
    expect(formatRatio(4.4999)).toBe("4.49:1");
    expect(formatRatio(21)).toBe("21.00:1");
  });
});

describe("sniffType", () => {
  it("knows each type a skin may hold by its first bytes", () => {
    expect(sniffType(PNG_BYTES)).toBe("png");
    expect(sniffType(WOFF2_BYTES)).toBe("woff2");
    expect(sniffType(WEBM_BYTES)).toBe("webm");
    expect(sniffType(MP4_BYTES)).toBe("mp4");
  });

  it("calls everything else unknown", () => {
    const quickTime = Uint8Array.from([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
    const matroska = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x88, ...new TextEncoder().encode("matroska")]);
    const woff1 = new TextEncoder().encode("wOFF0000");
    for (const bytes of [TEXT_BYTES, quickTime, matroska, woff1, new Uint8Array(0), PNG_BYTES.subarray(0, 4)]) {
      expect(sniffType(bytes)).toBe("unknown");
    }
  });
});
