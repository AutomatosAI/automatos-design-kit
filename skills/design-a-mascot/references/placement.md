# Where a mascot goes

The places, their props and which pages reach each one are in
[guides/mascot-placement.md](../../../guides/mascot-placement.md); read it first. This page is what they mean for the
mascot's design.

## The theme's own surfaces

The frame (`frame@1`), the theme's own pages and routes, and its edge screens (`notFound@1`, its asleep screen) are
the theme's components, so the mascot can go anywhere in them, at any size the theme draws. Under the Studio base
they are the only way onto `/chat`, `/assignments`, `/agents`, `/command-center` and `/`: none of those draws a
placement slot.

## The three placement slots

Core's shared page header and empty state offer three slots. A theme lists the ones it fills in `theme.json` `slots`
and registers one component for each with `host.registerSlot(id, Component)`.

| Slot | Where it draws | Props |
|---|---|---|
| `page-header.art@1` | The shared page header: first in the header's row, before the title | `base`, `title`, `titleAccent`, `eyebrow` |
| `page-header.mascot@1` | The shared page header: after the title, before the actions | `base`, `title`, `titleAccent`, `eyebrow` |
| `empty-state.mascot@1` | The shared empty state, in place of its icon tile | `base`, `title`, `description` |

- `base` is `studio` or `classic`, the layout that draws the page: one component sizes itself for either head.
- The component draws inside `<div data-theme-slot="<slot id>">`, which the theme's CSS may style under its own class.
- The props carry no mascot state: the theme's component chooses which state shows there.
- A slot sits in a row of text or in place of an icon: draw a state that still reads at that size, and give it the
  same Pause control, still and caption as anywhere else.
- With nothing registered, the page is exactly as it was; a component that throws is replaced by the host's own
  markup. A page the theme replaces draws its own page, so no core slot draws there.

## Not a place: the AI label

The host draws the label that says Auto is an AI beside every chat, outside the theme's page and frame. No slot
reaches it, a mascot never covers or copies it, and a theme that hides it pauses its own chat.

## How the kit's themes place Auto

- **Play** uses no placement slot: it replaces `/chat` and `/deliverables` and draws Auto in its own surfaces, at
  three sizes (the guide's "How Play places Auto").
- **HUD** draws Auto in its frame, at the foot of its rail, and in the voice core on its core screen, and fills no
  placement slot either.
