# PRD-004: The Automatos Skin Kit

Status: decisions taken 14 Oct 2026 (§7). Companion: core PRD-259 (Skins in Studio; draft at `docs/prd/core/PRD-259-SKINS-IN-STUDIO.md`).

## 1. Introduction

`automatos-play` becomes the **Automatos Skin Kit**: a separate app developers and designers run locally to make skins for Studio. Gerard's flow (14 Oct):

1. A developer clones the kit.
2. The repo holds everything needed to build a skin, with Auto as an optional mascot.
3. They use Claude Code or Codex with the kit's skills and designs, or the visual editor, to design it.
4. They export a `.autoskin` file and load it into their Studio (Style → Add a skin…), or submit it to the Marketplace.
5. Other workspaces install it from the Marketplace like any other item, then use and remix it.

The kit doesn't rebuild Studio's pages (waves 3–4 showed that's the wrong path). It previews a skin on **Studio-shaped components** and produces a validated file.

## 2. Goals

- Clone, then `npm install && npm run dev`, then design and preview, then export: in under 15 minutes for a first skin.
- An editor reworked from the Looks PoC: free colours with live AA checks, both tones, fonts, radius, glow and mascot.
- A preview that looks like Studio: the same token names and component shapes.
- `npm run validate` and `npm run pack` from the command line, for AI-made skins.
- A skill so Claude Code or Codex can make a skin end to end.
- Four example skins and a mascot guide.

## 3. What the kit contains

- **`spec/`:** `automatos-skin.v1.schema.json`, synced from Studio (`npm run sync-schema` reads `GET /api/skins/schema` from a running Automatos, or from a local `automatos-ai` checkout). CI fails if the copy is stale against the version it records.
- **`skills/build-automatos-skin/`:** SKILL.md plus references:
  - the token guide: what each token colours in Studio, with screenshots;
  - contrast rules and how the kit derives readable text;
  - fonts;
  - the mascot guide (the pipeline from `mascot/README.md`: a hero image, 12 looping clips with first and last frame the same, the on-device cut-out, WebM/MP4/PNG);
  - packaging, submitting.
- **`skins/`:** example skins as source folders: Ember, Daylight, Workshop (the original Play night look) and Neon (a dark-only, Jarvis-feel skin). Each has `skin.json` and `assets/`.
- **The app** (Next.js, reusing PRD-001 and PRD-002 code where it fits):
  - **Skin editor:** start from an example or from Studio's own look. Colour groups (Surfaces, Text, Brand, Status, Charts), each colour with live contrast badges for its text pairs. Light and dark side by side. Fonts (pick from Studio's set or drop in woff2 files). Radius and glow. Mascot (off, Auto, or custom clips).
  - **Preview:** a gallery of Studio-shaped components: the sidebar and nav, the chat ledger with tool lines and receipts, cards, tables, filter tabs, the stats bar, buttons, inputs, badges, charts, modals. They're built on the same token names as Studio (`hsl(var(--background))` and so on), in both Studio and Classic bases, Light and Dark.
  - **Live style sheet:** every token with its value and contrast numbers (from PRD-002 L-007).
  - **Export:** a `.autoskin` file, the same as `npm run pack`.
  - **Load into my Automatos:** with a local Automatos running, posts the file to `POST /api/skins/import` through the kit's server proxy (the PRD-001 proxy and safety rules). The skin appears in Studio's Style list at once.
  - **Submit to the Marketplace:** opens the submit page of the user's Automatos with the file ready. Local edition only: submits through the same proxy.
- **CLI:** `npm run validate <dir|file>` (the same rules as Studio, with plain-word errors) and `npm run pack <dir>`, which writes `dist/<slug>-<version>.autoskin`.

## 4. What happens to the current Play code

| Code | Becomes |
|---|---|
| `lib/looks/` (Look format, contrast, `readableOn`, pre-paint, store, transfer) | the editor's engine, widened from catalogue keys to free colours with AA gates |
| `components/looks/` (editor, Looks row, import/export, style page) | the editor and the live style sheet |
| `lib/mascot/`, `components/mascot/` | the mascot preview, and ported to Studio by PRD-259 S-007 |
| `lib/server/` (proxy and safety) | the "Load into my Automatos" and "Submit" proxy |
| `skills/build-automatos-interface/` | kept, as a reference for anyone building a whole interface |
| the rebuilt pages (chat, conversations, Deliverables, Missions, Agents, Knowledge) | retired from the kit; kept in git history (PRs #1 and #3) |

## 5. Stories (one wave)

- K-001 restructure the repo into the kit layout; retire the rebuilt pages (kept in history); the app shell becomes Editor · Preview · Style sheet · Examples
- K-002 the schema sync, the shared validator (ported from Studio's rules) and the `validate` CLI
- K-003 the skin model and editor engine: free colours, both tones, live AA, `readableOn` suggestions
- K-004 the editor UI
- K-005 the Studio-shaped preview gallery (both bases, both tones)
- K-006 fonts and mascot in the editor (woff2 check, the 12-clip set check)
- K-007 `pack` and Export; Load into my Automatos; Submit
- K-008 the four example skins, each passing `validate` in CI
- K-009 the `build-automatos-skin` skill and the guides; the README for designers and developers

## 6. Non-goals

- Making whole new interfaces (that's the `build-automatos-interface` skill, kept for reference).
- Hosting skins (Studio and the Marketplace hold them).
- Generating mascots inside the kit (the guide explains the pipeline; tools and keys stay with the person).

## 7. Decisions (Gerard, 14 Oct 2026) and open questions

1. **Name:** the repo stays `automatos-play` for now.
2. **PRs #1–#3:** merge later. PRD-004 builds on the current branch stack; PR #3's rebuilt pages are retired in K-001, and stay in git history.
3. **Example skins:** may use Auto's clips (rights settled, see PRD-259 §10). The clips stay git-ignored in this repo until it goes public, and are copied in locally as today.
4. **Open:** is Neon (the Jarvis feel) enough for now, or do you want a layout-level Jarvis skin later (a PRD-259 non-goal)?
