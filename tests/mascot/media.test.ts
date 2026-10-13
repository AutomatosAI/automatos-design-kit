// @vitest-environment node
import { describe, expect, it } from "vitest";

import { captionFor, clipUrls, posterUrl, ringTone, videoFormat } from "@/lib/mascot/media";
import { MASCOT_STATES } from "@/lib/mascot/types";

const UA = {
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1",
  firefoxIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15",
  chromeIpadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Safari/604.1",
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  opera:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  jsdom: "Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/30.1.2",
} as const;

describe("videoFormat", () => {
  it("gives Safari and every iOS browser the HEVC alpha .mp4", () => {
    expect(videoFormat(UA.safariMac)).toBe("mp4");
    expect(videoFormat(UA.safariIphone)).toBe("mp4");
    expect(videoFormat(UA.chromeIphone)).toBe("mp4");
    expect(videoFormat(UA.firefoxIpad)).toBe("mp4");
  });

  it("spots iPadOS asking for the desktop site by its touch points", () => {
    expect(videoFormat(UA.safariMac, 5)).toBe("mp4");
    expect(videoFormat(UA.chromeIpadDesktop, 5)).toBe("mp4");
    expect(videoFormat(UA.chromeMac, 0)).toBe("webm");
  });

  it("gives everything else the VP9 alpha .webm", () => {
    for (const ua of [UA.chromeMac, UA.chromeWindows, UA.edge, UA.opera, UA.firefoxMac, UA.chromeAndroid, UA.samsung, UA.jsdom, ""]) {
      expect({ ua, format: videoFormat(ua) }).toEqual({ ua, format: "webm" });
    }
  });
});

describe("clip files", () => {
  it("serves each state's clip and still from /auto/", () => {
    expect(clipUrls("searching", "webm")).toEqual({ video: "/auto/searching.webm", poster: "/auto/searching.png" });
    expect(clipUrls("oops", "mp4")).toEqual({ video: "/auto/oops.mp4", poster: "/auto/oops.png" });
    expect(posterUrl("idle")).toBe("/auto/idle.png");
  });
});

describe("ringTone", () => {
  it("colours the ring per state as mascot.dc.html does", () => {
    const tones = Object.fromEntries(MASCOT_STATES.map((state) => [state, ringTone(state)]));
    expect(tones).toEqual({
      hello: "mint",
      idle: "mint",
      listening: "mint",
      celebrate: "mint",
      thinking: "bronze",
      working: "bronze",
      searching: "bronze",
      reading: "bronze",
      oops: "coral",
      sleeping: "dusk",
      lost: "dusk",
      loading: "violet",
    });
  });
});

describe("captionFor", () => {
  it("names what Auto is doing in every state", () => {
    for (const state of MASCOT_STATES) expect(captionFor(state).length).toBeGreaterThan(0);
    expect(captionFor("searching")).toBe("Searching the web");
    expect(captionFor("idle")).toBe("Ready when you are");
    expect(captionFor("hello")).toBe("Hi, I'm Auto.");
    expect(captionFor("sleeping")).toBe("Automatos isn't running");
  });

  it("says which Deliverable is ready while Auto celebrates", () => {
    expect(captionFor("celebrate", "Report")).toBe("Your report is ready");
    expect(captionFor("celebrate", "  ")).toBe("All done");
    expect(captionFor("celebrate")).toBe("All done");
    expect(captionFor("idle", "report")).toBe("Ready when you are");
  });
});
