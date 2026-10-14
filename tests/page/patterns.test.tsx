import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailPage, SIDE_LABEL } from "@/components/page/DetailPage";
import { ACTIVITY, AUTO, LiveRunPage, progressPercent, PROGRESS, STEPS } from "@/components/page/LiveRunPage";
import { StateChip, STATE_TONES, type StateTone } from "@/components/page/StateChip";

// The detail and live run page patterns, and StateChip: glyph + word, never colour alone.

describe("StateChip", () => {
  const EXPECTED: [StateTone, string, string][] = [
    ["running", "●", "Running"],
    ["needs-you", "◆", "Needs you"],
    ["done", "✓", "Done"],
    ["failed", "✕", "Failed"],
    ["paused", "‖", "Paused"],
    ["queued", "○", "Queued"],
    ["idle", "—", "Idle"],
  ];

  it("has a glyph and a word for every tone", () => {
    expect(Object.keys(STATE_TONES).sort()).toEqual(EXPECTED.map(([tone]) => tone).sort());
  });

  it.each(EXPECTED)("renders %s as its glyph and word, the glyph hidden from screen readers", (tone, glyph, word) => {
    const { container, unmount } = render(<StateChip tone={tone} />);
    const chip = container.firstElementChild;
    expect(chip).toHaveAttribute("data-tone", tone);
    expect(chip).toHaveTextContent(`${glyph}${word}`);
    const hidden = within(chip as HTMLElement).getByText(glyph);
    expect(hidden).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(word)).toBeInTheDocument();
    unmount();
  });

  it("can say a more exact word with the tone's glyph", () => {
    const { container } = render(<StateChip tone="running" label="Planning" />);
    expect(container.firstElementChild).toHaveTextContent("●Planning");
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });
});

describe("DetailPage", () => {
  it("shows the back link, the header, the main column and the side panel", () => {
    render(
      <DetailPage
        back={{ href: "/agents", label: "Agents" }}
        title="Researcher"
        chips={<StateChip tone="running" label="Working" />}
        actions={<button type="button">Pause agent</button>}
        side={<p>Model: Sonnet</p>}
        sideLabel="About this agent"
      >
        <p>Recent runs</p>
      </DetailPage>,
    );
    expect(screen.getByRole("link", { name: "Agents" })).toHaveAttribute("href", "/agents");
    expect(screen.getByRole("heading", { level: 1, name: "Researcher" })).toBeInTheDocument();
    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause agent" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByText("Recent runs")).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "About this agent" })).getByText("Model: Sonnet")).toBeInTheDocument();
  });

  it("leaves the side panel out when there is none, and names it Details by default", () => {
    const { rerender } = render(
      <DetailPage back={{ href: "/knowledge", label: "Knowledge" }} title="Handbook.pdf">
        <p>Body</p>
      </DetailPage>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    rerender(
      <DetailPage back={{ href: "/knowledge", label: "Knowledge" }} title="Handbook.pdf" side={<p>Size</p>}>
        <p>Body</p>
      </DetailPage>,
    );
    expect(screen.getByRole("complementary", { name: SIDE_LABEL })).toBeInTheDocument();
  });
});

describe("LiveRunPage", () => {
  it("shows the header with its state and actions, progress, steps, activity, Auto and the side panel", () => {
    render(
      <LiveRunPage
        back={{ href: "/missions", label: "Missions" }}
        title="Launch plan"
        state={{ tone: "needs-you", label: "Plan ready" }}
        actions={<button type="button">Approve plan</button>}
        progress={{ value: 3, max: 5, label: "3 of 5 steps done" }}
        steps={<ol aria-label="Mission steps" />}
        activity={<ul aria-label="Mission activity" />}
        mascot={<div role="img" aria-label="Auto stand-in" />}
        mascotCaption="Auto is waiting for you"
        side={<p>Budget</p>}
        sideLabel="About this Mission"
      />,
    );
    expect(screen.getByRole("link", { name: "Missions" })).toHaveAttribute("href", "/missions");
    expect(screen.getByRole("heading", { level: 1, name: "Launch plan" })).toBeInTheDocument();
    expect(screen.getByText("Plan ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve plan" })).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: PROGRESS });
    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(bar).toHaveAttribute("aria-valuetext", "3 of 5 steps done");
    expect(screen.getByText("3 of 5 steps done")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: STEPS })).getByRole("list", { name: "Mission steps" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: ACTIVITY })).getByRole("list", { name: "Mission activity" })).toBeInTheDocument();
    const auto = screen.getByRole("complementary", { name: AUTO });
    expect(within(auto).getByRole("img", { name: "Auto stand-in" })).toBeInTheDocument();
    expect(within(auto).getByText("Auto is waiting for you")).toHaveAttribute("aria-live", "polite");
    expect(within(screen.getByRole("complementary", { name: "About this Mission" })).getByText("Budget")).toBeInTheDocument();
  });

  it("puts the lead (a confirmation, a refusal) between the header and the progress", () => {
    render(
      <LiveRunPage
        title="Launch plan"
        state={{ tone: "running" }}
        lead={<p>Cancel this Mission?</p>}
        progress={{ value: 1, max: 2, label: "1 of 2 steps done" }}
      />,
    );
    const lead = screen.getByText("Cancel this Mission?");
    const header = screen.getByRole("heading", { level: 1 }).closest("header");
    expect(header?.compareDocumentPosition(lead)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(lead.compareDocumentPosition(screen.getByRole("progressbar"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("leaves out the slots it isn't given", () => {
    render(<LiveRunPage title="Quiet run" state={{ tone: "queued" }} />);
    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("works out progress as a whole percentage, safe with nothing to do", () => {
    expect(progressPercent(3, 5)).toBe(60);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(7, 5)).toBe(100);
    expect(progressPercent(-1, 5)).toBe(0);
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(Number.NaN, 4)).toBe(0);
  });
});
