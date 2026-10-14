import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EditorPage from "@/app/page";
import NotFound from "@/app/not-found";
import StyleSheetPage from "@/app/style/page";
import { LookProvider } from "@/components/looks/LookProvider";
import { AppShell } from "@/components/shell/AppShell";
import { LOST_LINK } from "@/components/shell/LostScreen";
import { HELLO_KEY } from "@/lib/mascot/session";

import { filesUnder, readSource } from "./css";

// US-014: Tab reaches every button, link and field, in each screen. (The ring it shows
// is checked in the stylesheets: tests/a11y/css.test.ts.)

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/") }));

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select, [tabindex]";
const MAX_STOPS = 150;

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
  it("reaches the shell and every control in the editor", async () => {
    const user = userEvent.setup();
    render(
      <LookProvider>
        <AppShell>
          <EditorPage />
        </AppShell>
      </LookProvider>,
    );
    await screen.findByRole("link", { name: "See the style sheet" });
    await expectAllReachable(user);
  });

  it("reaches the shell and Copy tokens on the style sheet", async () => {
    const user = userEvent.setup();
    render(
      <LookProvider>
        <AppShell>
          <StyleSheetPage />
        </AppShell>
      </LookProvider>,
    );
    await screen.findByRole("button", { name: "Copy tokens" });
    await expectAllReachable(user);
  });

  it("reaches the way back to the editor on the 404", async () => {
    const user = userEvent.setup();
    render(<NotFound />);
    const stops = await tabStops(user);
    expect(stops).toEqual([screen.getByRole("link", { name: LOST_LINK })]);
  });

  it("never takes an element out of the tab order or reorders it", () => {
    const sources = [...filesUnder("components", [".tsx"]), ...filesUnder("app", [".tsx"])];
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources) {
      expect({ file, tabIndex: /tabIndex\s*=/.test(readSource(file)) }).toEqual({ file, tabIndex: false });
    }
  });
});
