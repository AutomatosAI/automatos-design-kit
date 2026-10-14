import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LookProvider, useLook } from "@/components/looks/LookProvider";
import { lookToCssVars } from "@/lib/looks/css";
import { DAYLIGHT, EMBER } from "@/lib/looks/presets";
import { ACTIVE_LOOK_KEY, SAVED_LOOKS_KEY, type StorageSource } from "@/lib/looks/storage";

import { blockedStorage, clearRoot, myLook, rootVars } from "./helpers";

function Probe() {
  const { look, saved, reducedMotion, setLook, saveLook, deleteLook, renameLook } = useLook();
  return (
    <div>
      <p>Active: {look.name}</p>
      <p>Saved: {saved.map((entry) => entry.name).join(", ") || "none"}</p>
      <p>Motion: {reducedMotion ? "reduced" : "full"}</p>
      <button type="button" onClick={() => setLook(DAYLIGHT)}>Use Daylight</button>
      <button type="button" onClick={() => saveLook(myLook())}>Save mine</button>
      <button type="button" onClick={() => setLook(myLook())}>Use mine</button>
      <button type="button" onClick={() => renameLook("my-look-1", "  Sunset  ")}>Rename mine</button>
      <button type="button" onClick={() => deleteLook("my-look-1")}>Delete mine</button>
    </div>
  );
}

function renderProvider(storage?: StorageSource) {
  return render(
    <LookProvider storage={storage}>
      <Probe />
    </LookProvider>,
  );
}

function stored(key: string): unknown {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  clearRoot();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearRoot();
});

describe("LookProvider", () => {
  it("applies Ember on <html> when nothing is stored, and writes nothing", async () => {
    renderProvider();
    expect(screen.getByText("Active: Ember")).toBeInTheDocument();
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(EMBER)));
    expect(window.localStorage.length).toBe(0);
  });

  it("switches the variables at once and keeps the choice", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "Use Daylight" }));
    expect(screen.getByText("Active: Daylight")).toBeInTheDocument();
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(DAYLIGHT)));
    expect(document.documentElement.style.getPropertyValue("--accent-text")).toBe("#AA4C1C");
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(DAYLIGHT);
  });

  it("starts in the stored Look after a reload", async () => {
    window.localStorage.setItem(ACTIVE_LOOK_KEY, JSON.stringify(myLook()));
    window.localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify([myLook()]));
    renderProvider();
    expect(await screen.findByText("Active: My look 1")).toBeInTheDocument();
    expect(screen.getByText("Saved: My look 1")).toBeInTheDocument();
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(myLook())));
  });

  it("falls back to Ember on corrupt storage and leaves it as it was", async () => {
    window.localStorage.setItem(ACTIVE_LOOK_KEY, "{not json");
    window.localStorage.setItem(SAVED_LOOKS_KEY, JSON.stringify([{ ...myLook(), accent: "#FF0000" }]));
    renderProvider();
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(EMBER)));
    expect(screen.getByText("Active: Ember")).toBeInTheDocument();
    expect(screen.getByText("Saved: none")).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalled();
    expect(window.localStorage.getItem(ACTIVE_LOOK_KEY)).toBe("{not json");
  });

  it("works in Ember without storage, and still switches Looks", async () => {
    const user = userEvent.setup();
    renderProvider(blockedStorage);
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(EMBER)));
    await user.click(screen.getByRole("button", { name: "Use Daylight" }));
    await waitFor(() => expect(rootVars()).toEqual(lookToCssVars(DAYLIGHT)));
    expect(console.warn).toHaveBeenCalled();
  });

  it("saves, renames and deletes the user's Looks", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "Save mine" }));
    await user.click(screen.getByRole("button", { name: "Use mine" }));
    expect(screen.getByText("Saved: My look 1")).toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([myLook()]);

    await user.click(screen.getByRole("button", { name: "Rename mine" }));
    expect(screen.getByText("Saved: Sunset")).toBeInTheDocument();
    expect(screen.getByText("Active: Sunset")).toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([{ ...myLook(), name: "Sunset" }]);

    await user.click(screen.getByRole("button", { name: "Delete mine" }));
    expect(screen.getByText("Saved: none")).toBeInTheDocument();
    expect(screen.getByText("Active: Ember")).toBeInTheDocument();
    expect(stored(SAVED_LOOKS_KEY)).toEqual([]);
    expect(stored(ACTIVE_LOOK_KEY)).toEqual(EMBER);
  });

  it("marks reduced motion on <html> for the CSS", async () => {
    stubReducedMotion(true);
    renderProvider();
    expect(screen.getByText("Motion: reduced")).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-motion", "reduce"));
    expect(document.documentElement.style.getPropertyValue("--motion")).toBe("0");
  });

  it("marks full motion when the user hasn't asked for less", async () => {
    stubReducedMotion(false);
    renderProvider();
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-motion", "full"));
    expect(document.documentElement.style.getPropertyValue("--motion")).toBe("1");
  });

  it("takes its variables off <html> when it unmounts", async () => {
    const { unmount } = renderProvider();
    await waitFor(() => expect(rootVars()["--accent"]).toBe("#FF6A1F"));
    unmount();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement).not.toHaveAttribute("data-motion");
  });
});

describe("useLook outside a provider", () => {
  it("reads Ember and warns instead of changing anything", async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByRole("button", { name: "Use Daylight" }));
    expect(screen.getByText("Active: Ember")).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("needs a LookProvider"));
  });
});
