---
name: brand-a-theme
description: Give an Automatos theme a brand's real colours, fonts, logo and voice from its brand kit - save the kit from the local edition as a file (or take a file saved that way), write a brief with automatos-theme brief, then turn the brief's grounds, accents and proposed pairs into the look data, its fonts and logos into the theme's assets, and its voice into the theme's own strings. Use when a theme should wear a brand, when asked for a theme in a brand's colours, or when given a brand kit file or a BRIEF.md.
---

# Brand a theme

A brand kit is a brand as Automatos keeps it for a workspace: its colour roles, fonts, logos and voice (Deliverables ›
Brand kit). This skill makes a theme wear one. `automatos-theme brief` reads the kit and proposes the grounds, the accents
and every text colour, each measured at WCAG AA; you turn that brief into the theme's look data, its files and its
words. The theme then carries the brand in its own package: at run time it reads nothing from the brand kit.

## When to use

- A new theme, or a new preset of one, that should wear a brand.
- You were given a brand kit file or a `BRIEF.md`.

For a theme made for one business in that business's brand, follow
[white-label-from-a-brand-kit](../white-label-from-a-brand-kit/SKILL.md), which uses this skill for the brand. For the
theme itself (the folder, the frame, the pages), [build-automatos-theme](../build-automatos-theme/SKILL.md).

## Read first

1. [references/brief-template.md](references/brief-template.md): what each section of a brief holds.
2. [guides/looks.md](../../guides/looks.md): the look schema, the presets, the first-paint table and recolouring the
   host's pages with Studio's triplets.
3. [guides/contract.md](../../guides/contract.md): the files a theme may hold (`assets/fonts/`, `assets/brand/`) and
   `theme.json`'s `brand` and `fonts`.
4. [docs/cli-design.md](../../docs/cli-design.md#brief): the brief command's flags, refusals and exit codes.

## 1. The brand kit, as a file

The brief reads a file, never an address. Get one of two ways:

- From your own local edition, which asks for no token (its API is on port 8000, the web app on 3000):

  ```sh
  curl -sf http://localhost:8000/api/documents/brand-kit -o brand-kit.json
  ```

  That is the brand kit of your workspace there: set it in Deliverables › Brand kit first.
- A file the brand's owner saved the same way from their own local edition and gave you.

Never read a brand kit from a hosted address, and never with a token or a key: the kit's tools work against the local
edition (hosted CLI auth is parked). The kit's own example is [fixtures/brand-kits/automatos.json](../../fixtures/brand-kits/automatos.json),
Automatos's public brand.

## 2. The brief

```sh
npx automatos-theme brief --brand-kit brand-kit.json --out briefs/<slug>/BRIEF.md
```

It writes nothing and says why when the file is not a brand kit (not JSON, no palette, a colour role that is not a
hex colour), and it never writes over a brief that is there. Read the whole brief, then finish its Theme section by
hand: the publisher, `base`, `minWidth`, the pages, the routes, the slots and the mascot.

Done when `BRIEF.md` has every section of the template and its Theme section has no open item.

## 3. The look data

With [write-a-look-schema-and-presets](../write-a-look-schema-and-presets/SKILL.md), from the brief's tables:

1. **Grounds.** A `ground` choice knob with one choice per ground you keep (the page, and the other ground for a
   preset of the other tone), and the tone rule from the Grounds table's tone column. Each choice paints the ground's
   colour and its surfaces (cards, header fills).
2. **Accents.** An `accent` choice knob with one choice per accent you keep. The accent itself paints fills, rings
   and icons, only on the grounds where the Accents table shows it at 3:1 or more. Its text colour is a pair table
   (accent by ground): the Accents table's text column for that ground's tone.
3. **Text.** Body, heading and secondary text per ground, from the Proposed pairs table, as they are.
4. **The host's pages.** Paint Studio's tokens with the triplets in the tables, so the pages the theme leaves to the
   host take the brand too.
5. **Pairs.** Declare in `design/contrast.json` each pair the theme draws, under your own variable names: every row of
   the Proposed pairs table you use, and every fill, ring and icon with `"min": 3`.
6. Run `automatos-theme check design <theme folder>`.

Done when `check design` passes on every preset. A pair it fails is fixed with a better colour from the brief, never by
lowering its `min`.

## 4. Fonts and logos

- **Fonts.** For each font file the brief lists, save it as the path it names, from your local edition:
  `curl -sf http://localhost:8000/api/documents/brand-kit/fonts/<id> -o <theme folder>/assets/fonts/<name>.woff2`.
  Put its licence beside it (`<name>.txt` or `.md`), list it in `theme.json` `fonts`, and declare its `@font-face`
  family with the theme's class first (`<htmlClass>-<name>`). A font with no file in the kit ships only when its
  licence lets you redistribute it; otherwise the stack's fallbacks draw the text.
- **Logos.** For each uploaded variant the brief lists:
  `curl -sf http://localhost:8000/api/documents/brand-kit/logo -o <theme folder>/assets/brand/logo.png` (`logo-dark`,
  `logo-mono` and `logo-mark` the same way). A link is downloaded once and kept as a file. `assets/brand/` takes PNG
  or WebP of at most 512 KB: convert a JPEG, shrink a larger file. Name the logo in `theme.json` as
  `"brand": { "name": "<brand name>", "wordmark": "assets/brand/logo.png" }`, and draw a variant with `assetUrl`.

## 5. The words

The theme's own strings (buttons, empty states, the 404, the look editor) follow the brief's Voice section: its tone
words, never its banned phrases. The product's words stay as they are: Auto, Mission, Deliverable, Playbook, Agent.
Auto's replies and the host's pages are not the theme's to write.

## 6. Check, pack and try

Build the theme, then `automatos-theme check <theme folder>` and `automatos-theme pack <theme folder> --out out`, and
try it on your local edition with `automatos-theme install out/<file>.autotheme --to http://localhost:8000 --choose`
([build-automatos-theme](../build-automatos-theme/SKILL.md), "Check, pack and try").

## Rules

- **One file in, nothing live.** The brand kit is read once, into a file, from the local edition or its owner. The
  theme's colours are its look data and its fonts and logos are files in its package: it calls no address for them.
- **AA on every preset.** Text at 4.5:1 or more and fills, rings and icons at 3:1 on every ground a look can pick, the
  brief's pairs first, then `check design`.
- **The brand is its owner's.** Fonts only with a licence that lets you ship them; logos as the owner gave them. A
  brand kit, brief, logo or font that is not public never goes into a public repository.
- **Verify by the output.** Never report a pair readable, or a check passed, without having seen `check design`, `check`
  or CI say so.
