# PRD-002: Looks, make Automatos Play yours (PoC, Ember)

Status: draft, built overnight as a proof of concept · 14 Oct 2026 · Stacked on PRD-001 (`ralph/play-pilot`)

## 1. Introduction

PRD-001 built Automatos Play with one fixed theme. Claude Design then produced **Ember**, a warmer and more editorial direction, plus a working prototype of **Looks**: a picker that re-themes the whole interface live (accent, background, type, Auto's shell, Auto's light, glow). A second package, **Command**, uses the same idea for a HUD-style interface.

This PoC makes Looks real in Play, with Ember as the default. It is the first step towards Play as a **design kit**: people design the look of their Automatos and, later, share it on the Marketplace. Sharing is out of scope here. This PoC proves the format and the editing.

The rule that makes Looks shareable later: **a Look is data, not code.** It names entries from a fixed catalogue (grounds, accents, type styles, shells, lights) plus a glow number. It never carries raw colours or CSS. That makes a shared Look safe to install and guarantees every Look stays readable, because every pairing in the catalogue is checked.

Like PRD-001: local edition only, its own repo, **no change to `automatos-ai`**.

## 2. Goals

- One Look format, `automatos-interface-look/v1`, that Play uses now and Command can use later.
- Ember is Play's default Look, and every existing screen follows the active Look.
- A Looks page ("Make it yours") with live preview, the five presets and full editing.
- Saved Looks, plus export and import as JSON.
- A live style page that shows the active Look's tokens, contrast ratios, type and components, and redraws when the Look changes.
- Every Look in the catalogue passes WCAG AA for text and for button ink, proven by tests.

## 3. User stories

### L-001: The Look format and catalogue
**Description:** As a designer, I want one precise format for a Look so Looks can be saved, shared and checked.

**Acceptance criteria:**
- [ ] `lib/looks/catalogue.ts` holds the Ember catalogue exactly as in `docs/design/ember/Automatos Play Looks.dc.html`:
  - 4 grounds: graphite, obsidian, indigo ("Night"), paper, each with bg, surface, text, text2, line, chip and panel;
  - 6 accents with hex and ink: molten, cream, mint, gold, periwinkle, rose;
  - 4 type styles: serif "Editorial", clean, bric "Characterful", round "Playful", each with family, style, weight, letter-spacing and sizes;
  - 4 shells with hex and CSS filter: bronze, gold, silver, cobalt;
  - 4 lights: mint, amber, ice, rose.
- [ ] Fixed, not themeable: error `#FF6B6B`.
- [ ] `lib/looks/types.ts` defines `Look = { schema: "automatos-interface-look/v1", id, name, sub, interface: "play", ground, accent, font, shell, light, glow }`, where each of ground, accent, font, shell and light is a key of its catalogue section, and `glow` is an integer from 0 to 40.
- [ ] `lib/looks/presets.ts` holds the 5 presets from the prototype: Ember (default), Obsidian, Aurora, Workshop and Daylight.
- [ ] `lib/looks/validate.ts` is a pure validator returning `{ ok: true, look } | { ok: false, errors: string[] }`. It rejects unknown keys, values outside the catalogue, a glow outside 0–40, and a wrong schema. It keeps `name` and `sub` as plain text, at most 40 characters each.
- [ ] Tests:
  - every preset validates;
  - each rejection case;
  - **contrast, for all 24 ground × accent pairs:** text on bg and on surface at least 4.5:1; text2 on bg and on surface at least 4.5:1; ink on accent at least 4.5:1; and the derived `accentText` and `errorText` (L-002) on bg and on surface at least 4.5:1.
  - Measured on 14 Oct: all text and ink pairs pass (lowest: text2 on paper, 5.12:1), but **raw accents as text on Paper fail** (molten 2.49:1), and so does **raw error coral on Paper** (2.41:1). That is why L-002 derives text variants. Log this in `docs/SKILL-GAPS.md` under "Design gaps": the Ember mocks put accent-coloured serif text on the page, which is unreadable on Daylight without the derived colour.
- [ ] Typecheck passes. Tests pass.

### L-002: Applying a Look
**Description:** As a user, I want the whole app to change when I change the Look.

**Acceptance criteria:**
- [ ] `lib/looks/css.ts`: a pure `lookToCssVars(look)` returns the CSS custom properties: ground colours, `--accent`, `--accent-ink`, `--accent-text` and `--error-text` (see below), `--accent-line` (45% alpha), `--accent-fill` (12%), `--glow` (`glow/100` alpha of the accent), the display font family, style, weight and letter-spacing, `--auto-light`, `--auto-shell-filter`, and `--error`.
- [ ] `lib/looks/contrast.ts` has pure WCAG helpers (relative luminance and contrast ratio) and `readableOn(colour, bg, surface, text)`. It returns `colour` when it is already at least 4.8:1 on both bg and surface. Otherwise it mixes `colour` toward the ground's `text` in 2% steps until it is. `--accent-text = readableOn(accent)` and `--error-text = readableOn(#FF6B6B)`. Anything that shows the accent or error **as text** (links, serif highlights, "Hit a snag", error words) uses these. Fills, rings and icons keep `--accent` and `--error`. Expected on Paper: molten text is about #A84A1B, and error text about #A84A49 (each at least 4.8:1).
- [ ] `components/looks/LookProvider.tsx` applies those variables on `document.documentElement`, exposes `{ look, setLook, saved, saveLook, deleteLook, renameLook }`, and stores them in localStorage: saved looks under `automatos-play.looks`, the active id under `automatos-play.look`. Every read and write is in try/catch, and the app works without storage.
- [ ] The Look is applied before first paint, through a small inline script in `app/layout.tsx` that reads the active Look, so the page never flashes the wrong colours.
- [ ] Tests: `lookToCssVars` output for Ember; the provider switches variables and persists; corrupt storage falls back to Ember.
- [ ] Typecheck passes. Tests pass.

### L-003: Ember as the default, everywhere
**Description:** As a user, I want Play to look like Ember out of the box.

**Acceptance criteria:**
- [ ] `app/theme.css` keeps spacing, radii and motion as static tokens, and maps every colour and display-type token to the Look variables from L-002. No component uses a literal colour (a test scans `app/` and `components/` CSS and TSX for hex colours outside `lib/looks/catalogue.ts` and fails if it finds one).
- [ ] Fonts via @fontsource packages: Instrument Serif (400, italic), Geist (400–700), Geist Mono, Bricolage Grotesque, Fredoka. No next/font/google, no Google Fonts link.
- [ ] Ember rules from `docs/design/ember/README.md`:
  - Instrument Serif italic for display only, never below 19px;
  - radii 6 paper · 8 tool line · 10 button · 14 card · pill chips;
  - the page glow crossfades with Auto's state over 600 ms;
  - messages rise 12px over 180 ms;
  - everything stops under prefers-reduced-motion.
- [ ] The existing screens (chat, conversations, shelf, detail, first open, not running, error, 404) follow the Ember mocks in `docs/design/ember/screens/` where they differ from the v1 mocks: layout as v1, styling as Ember.
- [ ] Typecheck passes. Tests pass.

### L-004: The Looks page
**Description:** As a user, I want to pick a look and tweak it, and see the result straight away.

**Acceptance criteria:**
- [ ] `app/looks/page.tsx` and a "Look" nav item, laid out as `docs/design/ember/screens/looks-01.png`:
  - the "Make it yours." heading, with the active Look's name and "· edited" when changed;
  - a live preview with Auto (mascot slot and caption), a user bubble, tool chips, Auto's answer, a Deliverable card with Open, and the message box;
  - the Looks row: presets then saved Looks, each a mini swatch card;
  - the editor panel: accent swatches, background, type (each option set in its own font), Auto's shell, Auto's light, and the glow slider (Off at 0).
- [ ] Every control changes the whole app at once, not only the preview.
- [ ] "Save as new look" adds "My look N" to the row and selects it. "Reset" returns to the selected Look's saved values.
- [ ] Keyboard: every control reachable, swatches announce their name, and the slider has a label and value.
- [ ] Component tests: picking a preset changes `--accent` on the root; editing marks "edited"; saving adds a Look; Reset restores it.
- [ ] Typecheck passes. Tests pass.

### L-005: Manage, export and import Looks
**Description:** As a designer, I want to keep, share and load Looks as files.

**Acceptance criteria:**
- [ ] Saved Looks can be renamed, duplicated and deleted. Presets can only be duplicated.
- [ ] "Export" downloads `<name>.look.json` (the Look object, pretty-printed) and also offers "Copy JSON".
- [ ] "Import" takes a pasted JSON or a chosen `.json` file and runs it through the L-001 validator. Valid Looks are added as saved Looks with a fresh id. Invalid ones show the validator's errors in plain words, and nothing is added.
- [ ] Imported text is never rendered as HTML.
- [ ] Tests: export then import round-trips; an invalid file shows errors and adds nothing; a 1 MB file is rejected before parsing.
- [ ] Typecheck passes. Tests pass.

### L-006: Auto follows the Look
**Description:** As a user, I want Auto's shell and light to match my Look.

**Acceptance criteria:**
- [ ] The mascot video and PNG take the shell's CSS filter.
- [ ] The ring and the "connected" dot use the Look's light colour for calm states. Busy states use the accent. oops stays error coral, and sleeping and lost use a dusk colour derived from the ground.
- [ ] Auto's light colour is used only for the ring, the eyes' glow and "connected" (the Ember rule).
- [ ] Tests: the ring colour for each state group under two different Looks; the filter mapping for each shell.
- [ ] Typecheck passes. Tests pass.

### L-007: The live style page
**Description:** As a designer, I want to see exactly what my Look produces, with the numbers.

**Acceptance criteria:**
- [ ] `app/looks/style/page.tsx`, linked from the Looks page ("See the style sheet"), laid out like the style sheet in `docs/design/ember/screens/` (the last panels). Every value is computed from the **active** Look and redraws when it changes:
  - **Colour:** a swatch for every token, with name, hex and role, plus live contrast ratios for text/bg, text2/bg, text/surface and ink/accent, each with an AA pass or fail badge (glyph plus word, never colour alone).
  - **Type:** the display specimen ("The fun way.", "Searching.", "Laptop shortlist") in the Look's display style, then body, label and mono specimens with sizes.
  - **Spacing and radii:** the 4px scale and the five radii, drawn.
  - **Components:** Send and Stop buttons, filter chips (on, off, focus), tool lines (running, done, failed), the receipts box, a Deliverable card, the message box, and the mascot slot in all 12 states with the ring colours.
  - **Motion:** the motion notes, with a toggle that plays them (off under reduced motion).
- [ ] "Copy tokens" copies the active Look's CSS variables as a `:root { … }` block.
- [ ] The colour section also shows `--accent-text` and `--error-text`, each with a note when it differs from the raw colour ("darkened for reading on Paper").
- [ ] Component tests: under Ember the page shows text/bg 16.36:1, text2/bg 8.54:1 and ink/molten 6.74:1 (each within 0.05); switching to Daylight changes the bg swatch hex and shows an accent text colour different from #FF6A1F.
- [ ] Typecheck passes. Tests pass.

### L-008: Docs for designers
**Description:** As a designer or a future Marketplace reviewer, I want the format explained.

**Acceptance criteria:**
- [ ] `docs/LOOKS.md`: what a Look is, the full catalogue, the JSON format with an example, the validation rules, the contrast guarantee, and why Looks hold keys and not raw colours (safe to share, always readable).
- [ ] It also covers how Command's `looks.json` (`docs/design/command/looks.json`) would map onto v1 as an `interface: "command"` catalogue with its extra fields (grid, scan, auto, motion). Doc only; Command is not built.
- [ ] Marketplace notes, for the later core PRD: a Look is data only, the install is "validate, then add to saved Looks", and a thumbnail can be rendered from the catalogue.
- [ ] `docs/RUN-CHECKLIST.md` gains the Looks checks: switch each preset, edit, save, reload (still applied, no flash), export, import, the style page numbers, and Auto's shell tint in Chrome and Safari.
- [ ] Typecheck passes.

## 4. Functional requirements

- FR-1: A Look must only reference catalogue keys. Raw colours, CSS and URLs are invalid.
- FR-2: The error colour and the catalogue's text colours are not themeable beyond the catalogue.
- FR-3: Every visible colour in the app comes from the active Look's variables.
- FR-4: Changing the Look must update the whole app without a reload.
- FR-5: The active Look must be applied before first paint.
- FR-6: Imported Looks must pass the validator before anything is stored.
- FR-7: The app must work, in Ember, when localStorage is unavailable.

## 5. Non-goals

These are for discussion with Gerard, not deferred decisions:
- Publishing or installing Looks through the Marketplace (a core change).
- Free colour pickers (custom hex). These would need computed ink and a live AA check.
- Templates (documents and socials) and full Interfaces as shareable items.
- Building Command.
- New mascot renders per shell. The shell is a CSS filter for now.

## 6. Design considerations

- Sources: `docs/design/ember/` (the Ember screens, the Looks prototype, the mascot slot, the README with tokens) and `docs/design/command/` (the HUD, its README and `looks.json`, for the shared format only).
- The Looks editor is a design tool inside a fun app: generous previews, instant feedback, no Save button needed for live changes ("Save as new look" only creates a named copy).

## 7. Technical considerations

- Builds on PRD-001's `app/theme.css` token rule. The Look layer only changes the variables' values.
- Pre-paint application: an inline script in the `<head>`, with no external resources, that reads localStorage in try/catch and sets the variables from a serialised catalogue.
- The same "nothing runs locally" rule: CI is the gate.

## 8. Success metrics

- 5 presets plus saved Looks, all passing AA by test.
- No literal colours outside the catalogue (enforced by test).
- Switching a Look updates the app in one frame, with no flash on reload.

## 9. Open questions

1. Should Looks be per workspace (stored in the core) or per browser (localStorage, as in this PoC)?
2. Should Marketplace Looks be one shelf with Templates, or separate?
3. Custom colours: allow them, with computed ink and an AA gate?
4. Do shells get real mascot renders ($0.56 a clip, 12 clips per shell)?

## Related

PRD-001 (`docs/prd/PRD-001-FUN-UI-PILOT.md`), `docs/design/ember/README.md`, `docs/design/command/README.md`.
