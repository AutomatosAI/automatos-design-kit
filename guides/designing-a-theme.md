# Designing a theme

What a designer needs to know before drawing an Automatos theme, so that what is drawn can be built as it is: what a
theme can change, which parts stay the host's, what data a theme can show, the shapes of looks and knobs, motion, the
phone skin, and the handoff the kit checks. The last section is a prompt to start a design session from (Claude
Design or any other tool). Building the design is [from-design-to-theme.md](from-design-to-theme.md); the facts here
are [contract.md](contract.md), [sdk.md](sdk.md) and [looks.md](looks.md) in short.

## What a theme can change

- **The frame**: what surrounds every page (a bar, a menu, a console, anything), from a width the theme names
  (`minWidth`, 0 to 3840 px) up. A theme may draw a layout of its own for narrow windows, down to that width.
- **Nine core pages**, which it may draw its own way: Chat (`/chat`), Deliverables, Missions and Playbooks
  (`/assignments`), one Mission, Agents, Knowledge (`/documents`), Playbooks, the Command Center and Home
  ([page-inventory.md](page-inventory.md)). Every other page stays the host's, drawn inside the frame and recoloured
  by the theme's look.
- **Pages of its own**, up to 16, under `/x/` (a map, a board, a gallery: whatever the design needs).
- **The look editor** (`/looks`), **the style sheet** (`/looks/style`), **the 404**, and the "backend is asleep"
  screen.
- **A mascot**: Auto as the host's clips, or the theme's own drawing, in up to 32 states.
- **Looks**: the knobs a person turns (colours, type, density, effects) and the presets they start from.
- **A phone skin** for Automatos Go: colours, fonts and the mascot's stills or clips, nothing else (below).

## What stays the host's

These are the host's own components. A design places them where it wants them and draws them as Studio draws them:
never restyled, recoloured, covered, hidden or imitated. In a mock, show each one as Studio's, with its real size.

| Part | What it is |
|---|---|
| Header utilities | Help, notifications, the theme menu and the account, as one cluster. Every frame shows it once. |
| Approval cards | A tool approval and a Mission plan approval, with their own Approve and Deny buttons. |
| Ticket, withdraw and Mission cards | A board ticket's live card, the offer to withdraw a request, the offer to make a Mission and the Mission made. |
| The voice button | Hold or tap to talk to Auto. While it talks, the host shows "AI voice assistant" and Stop under it: leave room. |
| Listen | The control that reads the day's brief in Auto's voice, with "AI voice assistant" and Stop while it reads. The brief, suggestion and reply-chip cards are the host's too, for a design that places them; a design may draw its own from the same data instead (below). |
| The AI label | "Auto is an AI", a tiny caption the host draws at the bottom right of the window (bottom left when Auto's floating widget is there) beside every chat. Draw nothing there, and draw no copy of it. |
| Banners | The used-up-credits banner and the local edition's first-run nudge. |
| File previews, Markdown | A Deliverable's file and every reply's text, through the host's own renderers. |
| Host pages | Every page the theme doesn't draw (Settings, the Marketplace, Analytics and the rest). |

**What is the theme's own, though it sits beside them**: the message box (the field and its Send and Stop buttons;
the theme draws it, and the host's AI label guard sits around it), the search button (it opens the host's search),
the menu, every window, frame and heading. Design these freely.

## What a theme can show

Everything comes from the host, through the theme SDK ([sdk.md](sdk.md)); a design never asks for a number the host
doesn't give.

| Area | What there is |
|---|---|
| Chat | The conversation: each message's words (Markdown), what Auto did (tool lines, receipts), the Deliverables a reply made (id, title, and kind: document, image or video), approvals, tickets, a Mission suggestion; whether Auto is writing; Send, Stop, Try again; the caller's conversations, newest first. One of Auto's messages may also carry the day's brief, a suggestion, or two or three short answers to tap (each at most 24 characters), which send as the person's own message. |
| Proactive | When the workspace has it on: the day's brief (its date, a greeting, Auto's read of the day, and five sections of rows with their counts: each row a title, why it is there, a time and, where it has them, a state, drawn as a glyph and a word, and an action), while Auto reads it which row he is on, and the person's thumbs up or down on it; Auto's open suggestions, with Start and Hide; what Auto depends on, each ready, not checked or needing setup. A day with no brief is normal: design the page without it too. |
| Voice | The session's phase (listening, thinking, speaking…), and the member's and Auto's levels for a waveform. |
| Deliverables | Each one's title, type (`report`, `document`, `image`, `spreadsheet`, `slide`, `blog_post`…), where it came from (a chat, a Mission, a task, a playbook, an upload, a social post…), the agent that made it, dates, summary, file and content. |
| Agents | Each agent's name, job title, type, status (`active`, `inactive`…), team and tags; the counts by type. |
| Missions | Each Mission's goal (a sentence, not a short title), its state (planning, running, waiting for you, done, failed…), its tasks (title, state, order), progress counts and recent events. |
| Today | Working now, completed today, needs you, agents active, tasks in the queue; the activity feed of runs; what is scheduled next; the open questions; the Needs-you rows (each names its agent by name). |
| Knowledge, Playbooks | Documents, teams and cloud folders; Playbooks, their steps and their runs. |
| Who and where | The workspace's name and plan, the edition (local or hosted), the caller's role, the backend's health, the trial's credits (granted and spent) where the workspace runs on credits. |

**What there isn't**, so leave it out or make it decoration: a budget, quota or health figure beyond a trial's
credits; levels or points stored anywhere (a theme keeps only small per-person state); an agent's progress through
its work; the agent behind a Needs-you row as an id (it is a name); who made a chat's Deliverable, or when (the chat
gives its title and kind); a "social post" type of Deliverable (a post is one whose source is a social post).

## Looks and knobs

- A knob is a **choice** (named options: palettes, accents, type pairs, on and off) or a **number** (a range painted
  as a transparency: a glow). There is no other kind. A size, such as a corner radius, is a choice of sizes. A colour
  a person picks is a choice of named colours, never a free value.
- A look's values are plain: colours, sizes and names. The first paint keeps no gradient, colour mix, fade, blur or
  shadow, so the theme draws those in its own CSS from the look's colours ([looks.md](looks.md)).
- Choice keys and knob names are lower-case letters and digits (knob names may use camelCase); choices also take
  dashes. Up to 32 knobs, 64 choices each.
- **Each knob has one default.** A default that depends on another knob ("scanlines: as the palette has them") is a
  preset's job: a preset sets every knob together.
- Up to 12 presets, each with a name and a line under it of at most 40 characters, and a tone (light or dark).
- Every colour that shows as text needs its pair declared and measured: 4.5:1 for text, 3:1 for a border, a ring or
  an icon, on every preset. A colour that reads as a fill may fail as text; give it a separate text colour.
- The host's own pages take the look's colours through Studio's tokens (ground, text, cards, accent, borders), so a
  palette should say what its page ground, window ground, text, quiet text, accent and accent ink are.

## Motion

- Under reduced motion nothing moves: no loop, no blink, no typing out; text shows whole.
- Anything that moves, blinks or loops for more than five seconds (a mascot, a cursor, a ticker) needs a pause
  control in the design (WCAG 2.2.2), kept per person.
- Draw nothing over the host's AI label, even something you can click through (scan lines, a vignette, a glow): keep
  such effects inside the theme's own boxes.

## The phone

Automatos Go runs no theme code. It paints a theme's phone skin onto its own Studio layout: colours (the theme's
looks, or two schemes of Studio's tokens), up to three fonts (`.ttf` or `.otf`, one file for each of titles, body and
labels) and the mascot's stills or clips. Don't draw phone screens for the app: they can't change. (A theme's own
layout in a phone's **browser**, below its desktop width, is the web theme's and can be anything.)

The app has five layouts built in (Studio, Play, HUD, Arcade and Candy); only Automatos's own themes switch the phone
to theirs (`automatos/play`, `automatos/hud`, `automatos/arcade` and `automatos/candy`). Candy's layout ships in a later
Automatos Go release; until then the app paints Candy's skin on Studio. A layout of your own would need an Automatos
Go release, so it is a proposal to Automatos, not part of the handoff
([mobile-skins.md](mobile-skins.md#the-phones-layouts)). [phone-layouts.md](phone-layouts.md) maps each layout's
screens, and says how to design for the phone with them ("For designers").

## The handoff

What the design hands over, in one folder:

- `README.md`: the rules (type, spacing, windows, motion, colour meanings) and the pages, one section each, with
  which host parts sit where.
- `looks.json`: the knobs and presets as below. `automatos-theme check handoff <folder>` checks it with the host's
  own look rules and measures every pair on every preset, before anything is built.
- A mock per screen (`*.html`), at 1440 px wide and, if the theme has a narrow layout, at 390 px.

```json
{
  "schema": "automatos-theme-handoff/v1",
  "theme": "acme/harbour",
  "default": "paper",
  "knobs": {
    "ground": { "kind": "choice", "label": "Ground", "choices": ["paper", "ink"], "default": "paper" },
    "glow": { "kind": "number", "label": "Glow", "min": 0, "max": 10, "integer": true, "default": 4 }
  },
  "presets": {
    "paper": { "name": "Paper", "sub": "Blue on paper", "tone": "light", "knobs": { "ground": "paper", "glow": 4 },
      "colours": { "page": "#F4EFE6", "win": "#FFFFFF", "text": "#1D1C1A", "accent": "#2458C7" } },
    "ink": { "name": "Ink", "sub": "Blue on ink", "tone": "dark", "knobs": { "ground": "ink", "glow": 6 },
      "colours": { "page": "#14181C", "win": "#1D2126", "text": "#EEF0F2", "accent": "#86AAF5" } }
  },
  "pairs": [
    { "text": "text", "ground": "win" },
    { "text": "accent", "ground": "page" },
    { "text": "accent", "ground": "win", "min": 3 }
  ],
  "phone": { "colours": "looks", "fonts": { "serif": "Display face", "sans": "Body face" }, "mascot": "stills" }
}
```

Every preset names the same colours, as `#rrggbb`; a pair names two of them. `phone` is optional: `colours` is
`looks` (the member's look) or `schemes` (a light and a dark scheme of their own), `fonts` names a face for any of
`serif`, `sans` and `mono` (a different face for each), and `mascot` is `clips`, `stills` or `none`.

## A prompt for a design session

Paste this into the design tool with the theme's own description after it:

```text
Design an installable theme for Automatos, an AI work platform, to be built with the Automatos design kit.
Follow these rules; the kit can build only what they allow.

1. A theme draws the frame around every page, its own versions of any of: Chat, Deliverables, Missions and
   Playbooks, one Mission, Agents, Knowledge, Playbooks, the Command Center, Home; up to 16 pages of its own; the look
   editor (Options), the style sheet, the 404. Every other page is the host's, inside the frame, in the look's colours.
2. These are the host's and appear as Studio draws them, never restyled or covered: the header utilities (help,
   notifications, theme menu, account), approval cards, ticket and Mission cards, the voice button (leave room under
   it for its caption and Stop), banners, file previews and every reply's Markdown. The host draws "Auto is an AI" at
   the bottom right of the window (bottom left when Auto's floating widget is there): keep that corner clear and
   never draw the words yourself. The message box, the search button, menus and windows are the theme's: design them.
3. Show only data the host gives: chat messages, tool lines, Deliverables (title, type, source, maker, date), agents
   (name, job title, type, status), Missions (goal, state, tasks, progress), today's counts (working now, completed
   today, needs you, agents active, in queue), questions, schedules, the day's brief and Auto's suggestions (when the
   workspace has them; a day without a brief is normal), the workspace and the caller. There is no budget or health
   figure beyond a trial's credits, no stored points or levels, no agent progress. Mark anything else as decoration.
4. Looks are knobs a person turns: each a choice of named options or a number range (a number paints a transparency,
   such as a glow; a size is a choice of sizes), with one default; presets set every knob together (up to 12, names
   and one-line descriptions of at most 40 characters, each light or dark).
   Every text colour reads at 4.5:1 on its ground and every border or icon at 3:1, on every preset.
5. Under reduced motion nothing moves. Anything that moves for more than five seconds has a pause control.
6. The phone app draws a skin of colours, up to three fonts and the mascot's stills or clips on its own Studio layout:
   don't design phone app screens, which need an app release. A narrow browser layout for the web theme is fine.
7. Hand over a folder: README.md (rules and pages, where each host part sits), looks.json in the
   automatos-theme-handoff/v1 shape (schema, theme, default, knobs, presets with tone, knob values and #rrggbb
   colours, pairs, optional phone), and an HTML mock per screen at 1440 px wide (and 390 px for a narrow layout).
```
