import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ExamplesPage from "@/app/examples/page";
import { EXAMPLES_HEADING, START_FROM_THIS } from "@/components/examples/ExamplesScreen";
import { EXAMPLE_SKINS } from "@/lib/skins/examples";

// PRD-004 K-008: /examples lists the four example skins with their picture and "Start from this".

const EXPECTED = [
  ["Ember", "ember", "Studio base · Light and dark · Mascot: Auto"],
  ["Daylight", "daylight", "Studio base · Light only · Mascot: Off"],
  ["Workshop", "workshop", "Classic base · Dark only · Mascot: Auto"],
  ["Neon", "neon", "Studio base · Dark only · Mascot: Off"],
] as const;

describe("the Examples page", () => {
  it("has its heading and one card per example, in order", () => {
    render(<ExamplesPage />);
    expect(screen.getByRole("heading", { level: 1, name: EXAMPLES_HEADING })).toBeInTheDocument();
    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => card.getAttribute("aria-labelledby"))).toEqual(EXPECTED.map(([, slug]) => `example-${slug}`));
  });

  it.each(EXPECTED)("shows %s with its picture, its facts and a link that starts the editor on it", (name, slug, facts) => {
    render(<ExamplesPage />);
    const card = within(screen.getByRole("article", { name }));
    expect(card.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    const picture = card.getByRole("img");
    expect(picture).toHaveAttribute("src", `/examples/${slug}/preview.png`);
    expect(picture.getAttribute("alt")).toContain(name);
    expect(card.getByText(facts)).toBeInTheDocument();
    expect(card.getByText(`skins/${slug}`)).toBeInTheDocument();
    const start = card.getByRole("link", { name: START_FROM_THIS });
    expect(start).toHaveAttribute("href", `/?start=${slug}`);
    expect(start).toHaveAccessibleDescription(name);
  });

  it("describes each example in its own words, from its skin.json", () => {
    render(<ExamplesPage />);
    for (const example of EXAMPLE_SKINS) {
      const card = within(screen.getByRole("article", { name: example.name }));
      expect(example.draft.meta.description).not.toBe("");
      expect(card.getByText(example.draft.meta.description)).toBeInTheDocument();
    }
  });
});
