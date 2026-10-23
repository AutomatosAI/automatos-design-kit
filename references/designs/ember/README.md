# Automatos Play — Ember design package

> **A design reference, not a theme.** Ember is the design Play was built from, made for the pilot before
> installable themes. Play itself is in `themes/play`. Lines that described the pilot's standalone app are marked
> **Obsolete**, each with today's rule beside it. Where this file and `AGENTS.md` disagree, `AGENTS.md` wins.
> `../../README.md` says what is here and what is missing.

Design mocks for Automatos Play, the fun second interface for a local Automatos install, made from the pilot's design brief.

## What's in here

| File | What it is |
|---|---|
| `Automatos Play Ember.dc.html` | The 9 screens at 1440 and 390, plus the style sheet. |
| `Automatos Play Looks.dc.html` | Working prototype of **Looks**, a theme picker with 5 presets and live editing. |
| `Mascot.dc.html` | The mascot slot: 12 states, page-drawn ring, light/shell/busy colour props. |
| `screens/*.png` | The screens of `Automatos Play Ember.dc.html` (`ember-01` to `ember-13`) and of `Automatos Play Looks.dc.html` (`looks-01`), as drawn. |

The `.dc.html` files load `support.js`, a runtime this kit does not ship, so they do not render as designed in a browser: read them as source, and look at `screens/` (`../../README.md`).

**Mascot image:** put a PNG named `auto-hero.png` in this folder and it replaces every placeholder; Play's mascot stills in `themes/play/assets/mascot/` work.

## Ember tokens

| Token | Value | Use |
|---|---|---|
| graphite | `#131110` | page |
| hearth | `#1D1917` | inputs, cards |
| cream | `#F4EEE8` | text, secondary button, paper |
| text-2 | `#B7ADA4` | secondary text (8.6:1) |
| text-3 | `#8A8077` | tertiary text (4.9:1) |
| molten | `#FF6A1F` | one primary action per screen; ink `#1A0A02` |
| ember | `#FF8A3D` | small accents, "new", "done" |
| gold | `#FFB070` | serif highlights |
| auto light | `#4BF0B7` | Auto's eyes, ring, "connected" only |
| snag | `#FF6B6B` | errors, always paired with ✕ and words |

**Type:** Instrument Serif italic for display only (never below 19px), Geist 400–700 for text, Geist Mono for tool lines and code. **Obsolete:** Vendor them via `next/font/local`, never `next/font/google`. *Now:* a theme ships its font files in its package, and every `@font-face` family starts with the theme's `<htmlClass>-` (`AGENTS.md`).

**Radii:** 6 paper · 8 tool line · 10 button · 14 card · pill chips. **Spacing:** 4px base.

**Mascot ring:** mint when calm or happy, bronze when busy, coral when he needs help, dusk when asleep or lost. The page draws the ring, not the video.

**Motion:**
- Messages rise 12px over 180ms.
- The ring pulses on a 2.4s loop.
- A Deliverable card lands with a 1.04 overshoot over 420ms.
- The page glow crossfades with Auto's state over 600ms.
- Everything stops under `prefers-reduced-motion`.

## Screens

1. **Chat:** searching
2. **Deliverable ready:** celebrate
3. **Conversations:** idle
4. **Deliverables shelf:** idle
5. **Deliverable detail:** no mascot
6. **First open:** hello
7. **Automatos isn't running:** sleeping
8. **Something went wrong:** oops
9. **404:** lost

## Looks (proposed for the pilot; Play ships these five presets and knobs)

Presets: Ember (default), Obsidian, Aurora, Workshop and Daylight. Users can change:
- accent (6 colours)
- background (Graphite, Obsidian, Night, Paper)
- type (Editorial, Clean, Characterful, Playful)
- Auto's shell (Bronze, Gold, Silver, Cobalt)
- Auto's light (Mint, Amber, Ice, Rose)
- glow (0–40%)

They can also save their own looks.

Rules:
- Errors stay coral in every look.
- Auto's light is only used for the ring, his eyes and "connected".
- Button ink is set per accent so contrast stays at AA.

Open questions for the PRD:
- Shell tint is a CSS filter over the mascot video. Truly different shells, or eyes in another colour, need extra renders from the mascot pipeline.
- The brief lists settings as out of scope, so Looks needs sign-off.
- **Obsolete.** Saved looks need a home. localStorage is enough for the pilot, and it needs no change in the core. *Now:* the host keeps a member's saved looks (the SDK's `looks` area).
