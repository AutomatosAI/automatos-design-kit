# Claude Design prompt: Automatos Play mocks

Paste everything below the line into Claude Design. Attach `auto-hero.png` (the mascot hero image) with it.

---

Design high-fidelity mocks for **Automatos Play**: a playful web interface for Automatos, an AI operating system that runs on the user's own computer. People use Automatos to get real work done by talking to **Auto**, its main AI. Auto answers, uses tools (web search, documents, data), hands work to other agents, and produces **Deliverables**: reports, documents, images, spreadsheets, slides.

Automatos already has a serious, professional interface called Studio. Play is a second, fun interface on the same system, aimed at younger users (students and people in their late teens and twenties) who run Automatos themselves. It should feel **fun and alive, but not childish**. Think of a well-made game launcher or a music app, not a toddler's toy.

## The mascot

The attached image is **Auto**, the mascot: a small floating automaton with a satin orange-bronze shell, a frosted-glass visor with two glowing mint eyes, a single metal crest on top (like a Greek helmet's), and short rounded arms. It hovers above a glowing mint ring of light. The idea comes from Greek myth: the self-moving golden helpers that Hephaestus built in his workshop.

In the product, Auto is a transparent animated video that sits on the page. The ring under him is drawn by the page, not the video, and changes colour with his state. Auto has 12 states. Show several of them across the mocks, using the attached image with the expression and pose each state describes:

| State | What Auto does | When |
|---|---|---|
| hello | waves, happy curved eyes | first open |
| idle | hovers, blinks | nothing happening |
| listening | leans in, eyes brighter | user is typing, or Auto is waiting for an answer |
| thinking | looks up, eyes drift side to side | waiting for Auto's reply |
| working | arms tapping busily, eyes narrowed | a tool is running |
| searching | turns side to side, eyes sweeping | a web search |
| reading | a glowing page shows on his visor | reading documents |
| celebrate | spins, arms up, happy eyes | a Deliverable is ready |
| oops | head tilt, eyes small, shrug | an error, or Auto needs help |
| sleeping | eyes dim to thin lines | idle for a while, or Automatos is not running |
| lost | looks around, shrugs | the 404 page |
| loading | slow spin | loading |

Rules for the mascot:
- He is beside or above the content, never covering text.
- Every state also has a text equivalent on screen (a typing indicator, a tool line, an error message). The page must make sense with the mascot hidden.
- Keep him a consistent size on each screen. He is a companion, not a hero banner on every page.

## Screens to design

Make every screen at **desktop (1440 wide)** and **phone (390 wide)**.

1. **Chat with Auto (the main screen).** A conversation in progress: the user's messages, Auto's answer streaming in, and compact tool lines between them (e.g. "Searching the web: 'best budget laptops for students 2026'" and then "Searched the web · 3 results · 2.1 s"). Show the **receipts** at the end of a turn: a short list of what Auto actually did ("Made a report: Laptop shortlist · Done"). A message box with a Send button, which becomes a Stop button while Auto is answering. Auto, in the *searching* state, sits beside the chat on desktop and above the message box on the phone.
2. **Chat, the moment a Deliverable is ready.** The same chat as Auto finishes: the *celebrate* state, plus a Deliverable card in the conversation ("Laptop shortlist, Report, just now") with an Open button.
3. **Conversations.** A list of past chats with title, last message preview and time ("Revision plan for chemistry", "Instagram captions for the bake sale", "Budget for the trip to Lisbon"), and a "New chat" button. On desktop it can be a side panel next to the chat; on the phone, its own screen.
4. **Deliverables shelf.** A grid of cards with thumbnail, title, type badge and date. Filter chips: All, Reports, Documents, Images, Spreadsheets, Slides. Make it feel like a collection the user is proud of: a trophy shelf, not a file manager. Auto in *idle*.
5. **Deliverable detail.** One opened report: title, type, date, which agent made it, and the content (headings, a short table, a chart image).
6. **First open.** A welcome moment with Auto in *hello*: one line explaining Play ("Your Automatos, the fun way"), and the message box ready, with three example prompts as chips.
7. **Automatos isn't running.** Auto in *sleeping*, a friendly explanation, and the command to start it shown as copyable code: `docker compose up`.
8. **Something went wrong.** In the chat, an error turn: Auto in *oops*, the error in plain words ("Auto couldn't reach the web search tool. Try again, or ask without searching."), and a Try again button.
9. **404.** Auto in *lost*, "This page wandered off", and a button back to chat.

Use realistic example content throughout, like the examples above. Never use lorem ipsum.

## Visual direction

- **Mood:** night-time workshop, a forge glow. A deep indigo or violet night background, with the mascot's own colours as accents: warm orange-bronze (#F07A2E region) and mint light (#4BF0B7 region). One light variant of the theme for daytime is welcome, but design dark first.
- **Type:** a characterful, rounded-geometric display face for headings, and a clean, highly legible sans for text. Generous sizes. Mono for tool lines and code.
- **Shape:** soft but not bubbly. Medium radii, clear surfaces, subtle glow on interactive things. Avoid making everything a pill.
- **Motion cues (annotate them, no need to animate):** messages arrive with a short rise, the ring pulses gently, a Deliverable card lands with a small bounce.
- **Accessibility:** text contrast at least WCAG AA, visible focus states, tap targets at least 44 px, and nothing that depends on colour alone.

## Words

Use these exact terms: **Auto** (a name: never "the assistant" or "the bot"), **Deliverable** (never "output", "file" or "artifact"), **Mission** (never "workflow" or "job"). Short, friendly, active sentences. Buttons say exactly what they do ("Send", "Stop", "Open", "Try again").

## Out of scope

No login or sign-up screens (Play has no accounts), no settings, no billing, no Missions screens, no document upload.

## What to deliver

The 9 screens at both sizes. A small style sheet: colour tokens, type scale, spacing, radii, and the components used (message bubble, tool line, receipt list, Deliverable card, filter chip, message box, mascot slot with its ring). And a note per screen saying which mascot state it shows and why.
