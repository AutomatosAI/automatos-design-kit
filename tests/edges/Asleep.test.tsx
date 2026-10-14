import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import { ASLEEP_TITLE, START_COMMAND } from "@/components/edges/AsleepScreen";
import { LiveShell } from "@/components/shell/LiveShell";
import { RECHECK_MS } from "@/hooks/useBackendStatus";
import { createApiClient, type Fetch } from "@/lib/client/api";

import { WORKSPACE } from "../chat/helpers";

// Mock 07: /api/workspace answers 502 (the proxy can't reach Automatos), so the whole
// window is the asleep screen until it answers.

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));

const ASLEEP = { error: "Automatos isn't running at http://localhost:8000" };

/** /api/workspace answers 502 until wake() is called; history is empty. */
function sleepingBackend() {
  let awake = false;
  const fetchMock = vi.fn<Fetch>(async (input) => {
    if (input.startsWith("/api/workspace")) {
      return awake ? Response.json(WORKSPACE) : Response.json(ASLEEP, { status: 502 });
    }
    if (input.startsWith("/api/chat/history")) return Response.json([]);
    throw new Error(`unexpected call to ${input}`);
  });
  const wake = () => {
    awake = true;
  };
  return { fetchMock, wake };
}

function workspaceCalls(fetchMock: Mock<Fetch>): number {
  return fetchMock.mock.calls.filter(([input]) => input === "/api/workspace").length;
}

function renderShell(fetchMock: Mock<Fetch>, recheckMs = 60_000) {
  const user = userEvent.setup();
  render(
    <LiveShell client={createApiClient(fetchMock)} recheckMs={recheckMs}>
      <p>the chat</p>
    </LiveShell>,
  );
  return user;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Automatos isn't running", () => {
  it("fills the window with Auto asleep, the command and Check again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchMock } = sleepingBackend();
    renderShell(fetchMock, RECHECK_MS);
    expect(await screen.findByRole("heading", { level: 1, name: ASLEEP_TITLE })).toBeInTheDocument();
    expect(screen.queryByText("the chat")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByTestId("auto-placeholder")).toHaveTextContent("sleeping");
    expect(screen.getByText(START_COMMAND)).toBeInTheDocument();
    expect(START_COMMAND).toBe("docker compose up");
    expect(screen.getByText("automatos-ai")).toBeInTheDocument();
    expect(screen.getByText(ASLEEP.error)).toBeInTheDocument();
    expect(screen.getByText("Play also checks every 10 seconds.")).toBeInTheDocument();
    expect(RECHECK_MS).toBe(10_000);
  });

  it("copies the command", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchMock } = sleepingBackend();
    const user = renderShell(fetchMock);
    await user.click(await screen.findByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(START_COMMAND);
  });

  it("Check again asks once more, and the app comes back when Automatos answers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchMock, wake } = sleepingBackend();
    const user = renderShell(fetchMock);
    const check = await screen.findByRole("button", { name: "Check again" });
    const before = workspaceCalls(fetchMock);
    await user.click(check);
    await waitFor(() => expect(workspaceCalls(fetchMock)).toBe(before + 1));
    expect(screen.getByRole("heading", { name: ASLEEP_TITLE })).toBeInTheDocument();

    wake();
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("the chat")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: ASLEEP_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Connected");
  });

  it("checks again on its own while asleep", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { fetchMock, wake } = sleepingBackend();
    renderShell(fetchMock, 30);
    await screen.findByRole("heading", { name: ASLEEP_TITLE });
    await waitFor(() => expect(workspaceCalls(fetchMock)).toBeGreaterThanOrEqual(3));
    wake();
    expect(await screen.findByText("the chat")).toBeInTheDocument();
  });

  it("shows the app, not the asleep screen, when Automatos answers", async () => {
    const fetchMock = vi.fn<Fetch>(async (input) =>
      input.startsWith("/api/workspace") ? Response.json(WORKSPACE) : Response.json([]),
    );
    renderShell(fetchMock);
    expect(screen.getByText("the chat")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Connected"));
    expect(screen.queryByRole("heading", { name: ASLEEP_TITLE })).not.toBeInTheDocument();
  });
});
