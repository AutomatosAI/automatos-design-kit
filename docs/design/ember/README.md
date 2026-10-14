# Automatos Play — Ember design package

Design mocks for Automatos Play, the fun second interface for a local Automatos install. Built from `docs/design/CLAUDE-DESIGN-PROMPT.md` in `AutomatosAI/automatos-play`.

## What's in here

| File | What it is |
|---|---|
| `Automatos Play Ember.dc.html` | The 9 screens at 1440 and 390, plus the style sheet. Open it in a browser. |
| `Automatos Play Looks.dc.html` | Working prototype of **Looks**, a theme picker with 5 presets and live editing. |
| `Mascot.dc.html` | The mascot slot: 12 states, page-drawn ring, light/shell/busy colour props. |
| `support.js` | Runtime the `.dc.html` files need. Keep it in the same folder. |

**Mascot image:** put `auto-hero.png` in this folder and it replaces every placeholder. The mascot assets stay out of git until the rights question in PRD-001 is settled.

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

**Type:** Instrument Serif italic for display only (never below 19px), Geist 400–700 for text, Geist Mono for tool lines and code. Vendor them via `next/font/local`, never `next/font/google`.

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

## Looks (proposed, not in PRD-001 yet)

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
- Saved looks need a home. localStorage is enough for the pilot, and it needs no change in the core.
