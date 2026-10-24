---
name: clone-and-redesign-a-page
description: Redesign one of the core Automatos pages a theme may replace (chat, Deliverables, Missions, Agents, Knowledge, Playbooks, the Command Center or home) starting from the core page itself - automatos-theme clone fetches the page's core source at the kit's pinned commit, checks it against the release's hashes, keeps it read-only under reference/core/ (never packed) and marks the page a clone in theme.json, then the page is redrawn in the theme's src/ on the SDK's page hooks. Use when a theme replaces a core page and should keep what that page does, or when check warns that a cloned page's core file has changed.
---

# Clone and redesign a page

A theme may replace nine core pages ([guides/contract.md](../../guides/contract.md), "Pages"). It can design one from
nothing (`"mode": "own"`) or start from the core page (`"mode": "clone"`): read what the core page shows and does,
then draw the same page the theme's way. This skill is the clone, one step of
[build-automatos-theme](../build-automatos-theme/SKILL.md) (its step 6, pages and routes).

**The copy is a reading reference, never code to ship.** A theme can't import core's code: `@/…` and `next/*` don't
exist for it, and the review refuses both. So the core files are kept beside the theme, read-only, and the page is
redrawn in `src/` with the SDK's hooks for that page, which read the same data the core page reads.

## When to use

- A theme replaces `/chat`, `/deliverables`, `/assignments`, `/missions/[id]`, `/agents`, `/documents`, `/playbooks`,
  `/command-center` or `/`, and should keep what the core page does: its data, its actions, its tabs and its states.
- `automatos-theme check` warns at `clonedFrom`: core has changed a file a clone copied (below).

Not for a page the theme draws its own way from the SDK alone (`own`), and never for a host page: the sign-in,
Settings, the Marketplace, the looks and the other host-owned routes stay the host's, and `clone` refuses them.

## Read first

1. [guides/page-inventory.md](../../guides/page-inventory.md): the nine pages, the core files a clone of each copies,
   the SDK area each reads, and the placement slots that reach it.
2. [guides/sdk.md](../../guides/sdk.md), "Page areas": every hook of those areas, and the `uses` name of each.
3. [guides/contract.md](../../guides/contract.md), "Pages": the page entry (`mode`, `keepCorePage`, `clonedFrom`).
4. [guides/pitfalls.md](../../guides/pitfalls.md), "Code": what the review refuses in `src/`.

The full template's `/agents` page is a finished clone to copy the shape of:
[agents-page.tsx](../../templates/full/code/src/components/agents/agents-page.tsx), cloned from core's
`components/agents/studio/agent-management-studio.tsx` and rewritten on the `pages/agents` area.

## The order of work

1. **Clone the page**, from the theme's folder or naming it ([docs/cli-design.md](../../docs/cli-design.md#clone)):

   ```sh
   automatos-theme clone /agents themes/<slug>
   automatos-theme clone '/missions/[id]' themes/<slug>
   ```

   Quote a route with brackets, as the second line does, so the shell passes it as it is. The command fetches each
   of the route's core files from the public core repo at the commit this kit vendors, checks each file's sha256
   against the release's `core-pages.json`, and only when every file matches writes them, read-only, under
   `reference/core/<path>` in the theme folder (never under `src/`). It sets `theme.json` `pages["<route>"]` to
   `"mode": "clone"` with `clonedFrom`: the route's last core file (the component that draws the page) and its
   sha256, keeping a `keepCorePage` list the page had. A hash that doesn't match, a failed fetch or a route a theme
   can't replace writes nothing. Done when the command lists the files it wrote and the page entry.
2. **Read the copy and write the page down.** From `reference/core/`: every query the page reads, every action,
   every tab, filter and link parameter, and its loading, empty and error states. For each, find the SDK hook that
   gives it ([page-inventory.md](../../guides/page-inventory.md), then [sdk.md](../../guides/sdk.md)). Done when every
   part of the page has a hook, or is marked as staying the host's.
3. **Leave the host what the SDK doesn't give.** A part with no SDK hook yet (on `/agents`, an agent's details or
   creating one) is not drawn by the theme: list the link parameters that open it (such as `tab`) in the page
   entry's `keepCorePage`, and the host draws its own page for those links. Done when `keepCorePage` names each
   such parameter (16 at most).
4. **Redraw the page in `src/`.** A component of the theme's own (`src/components/<page>/`) that imports only
   `@automatos/theme-sdk` and the theme's own files: its data from the page area's hooks, navigation through
   `HostLink` and `useHostRouter`, the host's cards from `cards`. Write it fresh, in the theme's design; never paste
   the copy into `src/` and never import from `reference/`, since core's imports (`@/…`, `next/*`, its own hooks
   and components) don't exist for a theme. Register it in `src/entry.ts` with `host.registerPage('<route>', Page)`
   and add the area's name to `theme.json` `uses` (`pages-agents` for `/agents`). Say in the component's comment
   which core file it was cloned from. Done when its test on the harness shows the page over the harness's
   fixtures, in each of its states.
5. **Check it.** After a build, `automatos-theme check themes/<slug>`: `clonedFrom` passes while the sha matches the
   release's, and `uses` agrees with the imports. `automatos-theme dev themes/<slug>` shows the page in the browser
   harness, and `automatos-theme shots themes/<slug>` on Chromium and WebKit. `automatos-theme pack` never packs
   `reference/`, so the package holds only the redrawn page.

## When core changes the page

A later host release may change a file a clone copied. `check` and the Marketplace review then warn at `clonedFrom`:
the clone may miss fixes and features the core page has now. Once the kit vendors that release, run
`automatos-theme clone <route>` again: it fetches the files at the kit's new commit, replaces the read-only copy and
moves the sha. Compare the new copy with the old one (in the theme's history, if you committed it), bring the page up
to what core's page does now, and the warning goes. Never edit the sha by hand to quiet it.

## Rules

- **The copy is for reading.** `reference/` stays out of the package and out of `src/`, and nothing in `src/`
  imports it. Its files are read-only: change the page, never the copy.
- **SDK only**, as for every theme page ([build-automatos-theme](../build-automatos-theme/SKILL.md), "Rules"): no
  network calls, no core imports, no browser storage of the theme's own.
- **Protected surfaces stay the host's.** A cloned page keeps the approval cards and the AI label as the host draws
  them ([pitfalls.md](../../guides/pitfalls.md)); a composer sits inside `cards.AiLabelFence`.
- **Never report a check as passed without having seen it pass**, in `check`'s output or in CI.
