# The tokens

A skin sets colours for **47 allowed tokens** (`ALLOWED_TOKENS` in `lib/skins/format.ts`), per tone. They are Studio's own CSS variables from `automatos-ai/frontend/app/globals.css`, read as `hsl(var(--name))` by Tailwind (`frontend/tailwind.config.ts`) and Studio's own rules. A token the skin leaves out keeps the base's value.

"In Studio" says what reads the token in the core (checked at core `6a584842`, 13 Oct 2026; file counts are `frontend/app`, `components` and `lib`). "In the kit's preview" names the parts of the `/preview` gallery (`components/preview/`) that show it, so you can see a change before Studio does. The editor's colour groups (Surfaces, Text, Brand, Status, Charts, Studio aliases: `lib/skins/groups.ts`) follow the same split as the tables below.

Values are HSL triplets without `hsl()` (`"16 100% 50%"`: hue 0–360, saturation and lightness in %, at most two decimals) or `#rrggbb`. The validator turns `#rrggbb` into a triplet.

## Surfaces

| Token | In Studio | In the kit's preview |
|---|---|---|
| `background` | The page ground (`bg-background`, 122 files): the body, sheets, inputs, outline buttons. | The frame, the chat ledger, fields, outline buttons, the active filter tab, the workspace switcher. |
| `card` | Cards and panels (`components/ui/card.tsx`, 86 files). | The sidebar, the stats bar, cards, the table, the chart card, the Deliverable card. |
| `popover` | Select menus, popovers, tooltips, the command palette and menubar (`components/ui/select`, `popover`, `tooltip`, `command`, `menubar`). | The composer, the modal, the toasts. |
| `muted` | Quiet fills: table row hover (`components/ui/table.tsx`), skeletons, avatar fallbacks (105 files). | The receipts box, the progress track, the hovered table row. |
| `secondary` | Secondary buttons and badges, the tab list (`components/ui/tabs.tsx`; 207 files). | Your chat message, the secondary button, the filter tab bar, Studio's sidebar. |
| `border` | Every default border (320 files). | Frame, sidebar, cards, table rules, modal, toasts, chart axes. |
| `input` | Borders of inputs, switches and toggles (20 files). | Fields, the composer, outline and Cancel buttons. |

## Text

Each of these is the text on its fill (`card-foreground` on `card` and so on); `references/contrast.md` lists the pairs that must read.

| Token | In Studio | In the kit's preview |
|---|---|---|
| `foreground` | Body text on `background` (282 files). | Page titles, Auto's answer, labels, field text, the active nav item. |
| `card-foreground` | Text in a card (`components/ui/card.tsx`). | Card, table, stats and chart text. |
| `popover-foreground` | Text in menus, popovers and tooltips. | Modal and toast text. |
| `primary-foreground` | Text on a primary button or badge (29 files). | Primary button, Send, the checked box, the header's New Mission. |
| `secondary-foreground` | Text on a secondary button or badge. | Your chat message, the secondary button. |
| `muted-foreground` | Secondary text everywhere: hints, meta, captions (491 files, the most used token). | Labels, meta lines, captions, nav items, tool lines, table headings, stat labels. |
| `accent-foreground` | Text on a hovered or selected item in menus, the command palette, toggles (12 files). | The ghost button in a card footer. |
| `destructive-foreground` | Text on a destructive button or badge. | Delete, Delete Playbook, the failed toast's mark. |
| `success-foreground`, `warning-foreground`, `info-foreground`, `agent-foreground` | Text on the status fills. Tailwind defines them; no Studio component reads them yet. | The status badges in the table, the toast marks. |

## Brand

| Token | In Studio | In the kit's preview |
|---|---|---|
| `primary` | The main action: default buttons and badges, sliders, checkboxes, progress (255 files). | The primary button, Send, checkboxes, the progress bar, the nav glyph, the title's accent word. |
| `accent` | Hover and selected items in menus and toggles. On the **Studio base** it is also Studio's brand colour: the active nav icon and filter tab, the error stat, `studio-pill.err` and `.brand`, the error log border. | The Deliverable tile, the ghost button, the alert count; on Studio, the active tab, the nav icon, the Failed stat. |
| `ring` | The focus ring (17 files: inputs, tabs, badges, sliders). | The focused composer and the focused field. |
| `destructive` | Destructive buttons, badges, form errors and alerts (236 files). | Delete, the failed tool line and receipt, the error toast, the Failed stat dot. |

## Status

| Token | In Studio | In the kit's preview |
|---|---|---|
| `success` | Done and healthy states (174 files). | The Done badge, done tool lines and receipts, the success toast, the Done stat dot. |
| `warning` | Needs-attention states (170 files). | The Needs you badge and stat dot. |
| `info` | Running and informational states (130 files). | The Running badge, the running tool glyph, the Running stat. |
| `agent` | An agent's identity colour: the roster, skills, messages, the stats bar, the agent log border. | The agent badge. |

## Charts

| Token | In Studio | In the kit's preview |
|---|---|---|
| `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5` | Tailwind's `chart` colours. Only `chart-3` and `chart-4` are read today (the sidebar's icon colours, `components/layout/sidebar.tsx` and `mobile-sidebar.tsx`). | The bar and line charts, series 1 to 5. |
| `stage-1`, `stage-2`, `stage-3`, `stage-4`, `stage-5`, `stage-6`, `stage-7`, `stage-8`, `stage-9` | The nine-stage pipeline colours. Defined in `globals.css`; no component reads them yet. | Not shown. Set them anyway if your palette differs, so the skin is ready when Studio uses them. |

## Studio aliases

Studio's own extra inks, read mostly by `.studio` rules in `globals.css` (some also on the Command Centre, `.cc-page`, and the chat, `.sh-chat`, in Classic). On the Classic base most of them have no effect.

| Token | In Studio | In the kit's preview |
|---|---|---|
| `olive` | Live and positive ink: the ok pill, ok dots, done pipeline steps, the Command Centre's ok figures. | Studio's Done stat value. |
| `warn-ink` | Amber warning ink: the Command Centre's warn figures and pills, attention icons, Missions needing approval. | Studio's Needs you stat value. |
| `on-strong` | Text on a strong fill: pips, the workspace mark, badges, avatars. | The workspace mark. |
| `border-2` | The darker border on hover (cards, log entries, the command palette). Studio writes it as a whole `hsl()` value; the skin still gives a triplet. | Not shown. |
| `accent-2` | A burnt-orange tint (a Mission card's id). Studio writes it at 10% opacity in light and 14% in dark. | Not shown. |
| `navy` | Info ink: the info pill, queued pips, plan entries, info progress, links in rendered markdown. | Not shown. |

## Derived, never set

Studio derives six aliases from the core tokens, and a skin that sets one is refused (`DERIVED_ALIASES`, `lib/skins/aliases.ts`):

| Alias | From |
|---|---|
| `paper` | `card` |
| `bg-1` | `background` |
| `bg-2` | `secondary` |
| `fg` | `foreground` |
| `fg-2` | `muted-foreground` |
| `fg-3` | `muted-foreground` at 75% opacity |

## Not colours

`shape.radius` (0–24 px) sets Studio's `--radius`: the corners of cards, buttons, inputs, dialogs (Tailwind's `rounded-lg/md/sm`). `shape.glow` (0–40 px) sets `--skin-glow`, the glow the preview shows on focused fields and live states. Fonts are in `fonts.md`.
