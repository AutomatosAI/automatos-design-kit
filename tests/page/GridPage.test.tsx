import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GridPage, type GridPageProps, type GridStatus, LOAD_MORE, LOADING_MORE } from "@/components/page/GridPage";
import { LOADING, SEARCH, TRY_AGAIN } from "@/components/page/parts";

// The grid page pattern: header, chips, search, and each state the page can be in.

type Filter = "all" | "running" | "done";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "done", label: "Done" },
] as const;

function grid(status: GridStatus, extra: Partial<GridPageProps<Filter>> = {}) {
  return render(
    <GridPage<Filter> title="Missions" status={status} {...extra}>
      <ul aria-label="Missions list">
        <li>Plan the launch</li>
      </ul>
    </GridPage>,
  );
}

describe("GridPage", () => {
  it("shows the title, the count and the header actions", () => {
    grid({ kind: "ready" }, { count: "12 Missions", actions: <button type="button">New Mission</button> });
    expect(screen.getByRole("heading", { level: 1, name: "Missions" })).toBeInTheDocument();
    expect(screen.getByText("12 Missions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Mission" })).toBeInTheDocument();
  });

  it("draws the filter chips as pressed buttons in a named group", async () => {
    const onSelect = vi.fn();
    grid({ kind: "ready" }, { filters: { label: "Show Missions by state", options: FILTERS, selected: "running", onSelect } });
    const group = screen.getByRole("group", { name: "Show Missions by state" });
    expect(within(group).getByRole("button", { name: "Running" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup().click(within(group).getByRole("button", { name: "Done" }));
    expect(onSelect).toHaveBeenCalledWith("done");
  });

  it("passes what is typed in the search box", async () => {
    const onChange = vi.fn();
    grid({ kind: "ready" }, { search: { label: "Search Missions", value: "", onChange } });
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search Missions" }), "l");
    expect(onChange).toHaveBeenCalledWith("l");
  });

  it("searches on Enter or the Search button when the page asks for a submit", async () => {
    const onSubmit = vi.fn();
    grid({ kind: "ready" }, { search: { label: "Search your documents", value: "tea", onChange: vi.fn(), onSubmit } });
    expect(screen.getByRole("search", { name: "Search your documents" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: "Search your documents" }), "{Enter}");
    await user.click(screen.getByRole("button", { name: SEARCH }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("says it is loading, in its own words or the default", () => {
    const { unmount } = grid({ kind: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent(LOADING);
    expect(screen.queryByRole("list", { name: "Missions list" })).not.toBeInTheDocument();
    unmount();
    grid({ kind: "loading", text: "Loading your Missions…" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading your Missions…");
  });

  it("shows the error with Try again", async () => {
    const retry = vi.fn();
    grid({ kind: "failed", error: "Play couldn't load your Missions.", retry });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Play couldn't load your Missions.");
    expect(screen.queryByRole("list", { name: "Missions list" })).not.toBeInTheDocument();
    await userEvent.setup().click(within(alert).getByRole("button", { name: TRY_AGAIN }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state with its way forward and the mascot slot", () => {
    grid({
      kind: "empty",
      message: "No Missions yet.",
      action: <button type="button">Start a chat</button>,
      mascot: <div aria-label="Auto stand-in" role="img" />,
    });
    expect(screen.getByText("No Missions yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a chat" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Auto stand-in" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Missions list" })).not.toBeInTheDocument();
  });

  it("shows the grid when ready, with Load more only when asked for", async () => {
    const onLoadMore = vi.fn();
    const { rerender } = grid({ kind: "ready" });
    expect(screen.getByRole("list", { name: "Missions list" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: LOAD_MORE })).not.toBeInTheDocument();
    rerender(
      <GridPage<Filter> title="Missions" status={{ kind: "ready" }} loadMore={{ onLoadMore, loading: false }}>
        <ul aria-label="Missions list" />
      </GridPage>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: LOAD_MORE }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("disables Load more while loading and says when it failed", () => {
    render(
      <GridPage<Filter>
        title="Missions"
        status={{ kind: "ready" }}
        loadMore={{ onLoadMore: vi.fn(), loading: true, error: "Play couldn't load more Missions." }}
      />,
    );
    expect(screen.getByRole("button", { name: LOADING_MORE })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Play couldn't load more Missions.");
  });
});
