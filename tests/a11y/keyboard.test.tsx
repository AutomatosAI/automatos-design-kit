import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotFound from "@/app/not-found";
import { ChatScreen } from "@/components/chat/ChatScreen";
import { ShelfScreen } from "@/components/deliverables/ShelfScreen";
import { AsleepScreen } from "@/components/edges/AsleepScreen";
import { AppShell } from "@/components/shell/AppShell";
import { createApiClient } from "@/lib/client/api";
import { HELLO_KEY } from "@/lib/mascot/session";

import { fixtureAnswer, mockChatFetch } from "../chat/helpers";
import { listBody, mockShelfFetch, row } from "../deliverables/helpers";
import { filesUnder, readSource } from "./css";

// US-014: Tab reaches every button, link and field, in each screen. (The ring it shows
// is checked in the stylesheets: tests/a11y/css.test.ts.)

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select, [tabindex]";
const MAX_STOPS = 80;

type User = ReturnType<typeof userEvent.setup>;

/** Tab from the top of the page until focus comes round again. */
async function tabStops(user: User): Promise<readonly Element[]> {
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  const stops: Element[] = [];
  for (let count = 0; count < MAX_STOPS; count += 1) {
    await user.tab();
    const focused = document.activeElement;
    if (!focused || focused === document.body || stops.includes(focused)) break;
    stops.push(focused);
  }
  return stops;
}

function describeElement(element: Element): string {
  return `<${element.tagName.toLowerCase()}> ${element.getAttribute("aria-label") ?? element.textContent ?? ""}`.trim();
}

async function expectAllReachable(user: User): Promise<void> {
  const focusable = [...document.body.querySelectorAll(FOCUSABLE)];
  expect(focusable.length).toBeGreaterThan(0);
  const stops = await tabStops(user);
  expect(focusable.filter((element) => !stops.includes(element)).map(describeElement)).toEqual([]);
  expect(stops.filter((element) => !focusable.includes(element)).map(describeElement)).toEqual([]);
}

beforeEach(() => {
  window.sessionStorage.setItem(HELLO_KEY, "1");
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("keyboard reach", () => {
  it("reaches the shell, the examples and the message box on the chat", async () => {
    const user = userEvent.setup();
    const client = createApiClient(mockChatFetch([fixtureAnswer("plain-answer")]));
    render(
      <AppShell recent={[{ id: "c1", title: "Laptop for uni" }]} connection="connected" host="localhost">
        <ChatScreen client={client} />
      </AppShell>,
    );
    await user.type(screen.getByRole("textbox", { name: "Message Auto" }), "Hello");
    await expectAllReachable(user);
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("reaches the filters, every card and Load more on the shelf", async () => {
    const user = userEvent.setup();
    const rows = [row("d-1", { title: "Laptop shortlist" }), row("d-2", { title: "Revision plan" })];
    const client = createApiClient(mockShelfFetch(() => Response.json(listBody(rows, 30))));
    render(<ShelfScreen client={client} now={new Date(2026, 9, 14, 15, 30)} />);
    await screen.findByRole("button", { name: "Load more" });
    await expectAllReachable(user);
  });

  it("reaches Copy and Check again when Automatos is asleep", async () => {
    const user = userEvent.setup();
    render(<AsleepScreen detail="Automatos isn't running at http://localhost:8000" onCheck={vi.fn()} recheckSeconds={10} />);
    await expectAllReachable(user);
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("reaches Back to chat on the 404", async () => {
    const user = userEvent.setup();
    render(<NotFound />);
    const stops = await tabStops(user);
    expect(stops).toEqual([screen.getByRole("link", { name: "Back to chat" })]);
  });

  it("never takes an element out of the tab order or reorders it", () => {
    const sources = [...filesUnder("components", [".tsx"]), ...filesUnder("app", [".tsx"])];
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources) {
      expect({ file, tabIndex: /tabIndex\s*=/.test(readSource(file)) }).toEqual({ file, tabIndex: false });
    }
  });
});
