---
name: white-label-from-a-brand-kit
description: Make a white-label Automatos theme for one business from its brand kit - take the kit as a file from that business's local edition, start the theme from a template without Auto's clips, give it the business's brand with brand-a-theme and automatos-theme brief, keep the business's files out of public repositories, and install the package privately on its local edition. Use when asked for a theme in a client's or a company's own brand, a white-label or rebranded Automatos, or one theme per customer.
---

# White-label a theme from a brand kit

A white-label theme makes Automatos look like one business's own product: its colours, type, logo and words around the
same host. It is an ordinary theme package; what makes it white-label is whose brand it wears and where it goes. The
brand work itself is [brand-a-theme](../brand-a-theme/SKILL.md); this skill is the order around it.

## When to use

- A theme for one business, in that business's brand, for its own Automatos.
- One theme per customer, each from that customer's brand kit.

Not for a theme of your own design: [build-automatos-theme](../build-automatos-theme/SKILL.md). Not for a brand alone
on a theme you already have: [brand-a-theme](../brand-a-theme/SKILL.md).

## What stays the host's

The host owns the data, the sign-in, the routes and the safety rails, so a white-label theme changes how Automatos
looks, not what it does. The approval cards and the AI label are protected surfaces: placed, never restyled, covered or
hidden. Auto keeps its name, a word of the product's ([build-automatos-theme](../build-automatos-theme/SKILL.md),
"Words"). The `automatos` publisher is Automatos's own: the theme's id is under your publisher or the business's.

## Steps

1. **The brand kit, as a file.** From the business's own local edition, on its machine (no token asked):

   ```sh
   curl -sf http://localhost:8000/api/documents/brand-kit -o brand-kit.json
   ```

   Or the file its owner saved that way and gave you. Never from a hosted address, never with a token or a key
   ([brand-a-theme](../brand-a-theme/SKILL.md), step 1).
2. **A private place to work.** The business's brand kit, brief, logos and fonts are its own. Work in a private copy
   of the kit (a private repository, or a clone you never push to a public one), so they never reach a public
   repository. A theme that bundles a kit library is built from the kit's layout, so keep the theme under the copy's
   `themes/`.
3. **The theme.** Start it with `npx automatos-theme new <publisher>/<name> --template full --mascot none` (every
   page and route Play has, de-branded, without Auto's clips; the chat still says what Auto is doing) or
   `--template minimal` (the frame alone, with the host's pages inside it).
4. **The brand.** `npx automatos-theme brief --brand-kit brand-kit.json --out briefs/<name>/BRIEF.md`, then
   [brand-a-theme](../brand-a-theme/SKILL.md) steps 3 to 5: the look data, the fonts and logos, the words. In the
   brief's Theme section, the name and `brand.name` are the business's.
5. **Nothing of the template's brand left.** Rename the presets and their `sub` lines, write the theme's `name`,
   `description`, `README.md` and `CHANGELOG.md` for the business, and read every string the template brought.
6. **Check and pack.** Build it, then `automatos-theme check design`, `automatos-theme check` and
   `automatos-theme pack`, as [build-automatos-theme](../build-automatos-theme/SKILL.md) does ("Check, pack and try").
7. **Install it privately.** On the business's local edition:
   `npx automatos-theme install out/<publisher>.<name>-<version>.autotheme --to http://localhost:8000 --choose`.
   The package is installed in that workspace alone. Submit it to the Marketplace only when the business asks for
   its theme to be listed.

Done when the theme passes `check design` and `check`, installs on the business's local edition, and nothing of its
brand kit, brief, logos or fonts is in a public repository.

## Rules

- **The business owns its brand.** Only a brand kit it gave you or saved itself; fonts only with a licence that lets
  you ship them; its logos as it gave them.
- **Private by default.** Never commit a business's brand kit, brief, logos or fonts to a public repository, and never
  submit its theme for listing unless it asks.
- **The local edition.** The brand kit comes from a local edition or a file, and the package goes back to one: no hosted
  address, no token.
- **AA on every preset**, as in [brand-a-theme](../brand-a-theme/SKILL.md): the brief's pairs, then `check design`.
- **Verify by the output.** Never report a check passed, or a theme installed, without having seen it.
