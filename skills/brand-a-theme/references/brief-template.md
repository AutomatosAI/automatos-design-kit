# Brief: <brand name>

The layout of the `BRIEF.md` that `automatos-theme brief` writes from a brand kit, section by section. The command
fills every section from the kit and measures every colour pair; you finish the Theme section by hand. A brief written
without the command (for a brand with no brand kit) keeps the same sections, in this order, and measures its pairs with
`automatos-theme check design` once the look data exists.

## Brand

The brand's name and tagline, its accent use (`sparing`: the accent for highlights only; `bold`: it may also fill
headers and large areas), and the file the brief was read from.

## Grounds

One row per ground candidate: the page (the kit's `paper`), cards (`surface`), header fills (`surface_2`), and the
other ground, the kit colour that stands furthest from the page (the dark ground of a light brand). Each with its
`#rrggbb`, its Studio triplet (`H S% L%`, for recolouring the host's pages), its tone (light or dark) and the kit field
it comes from.

## Accents

One row per accent candidate: the kit's `accent` and `accent_2` and its `primary_color` (the brand's own colour), each
measured as a fill on every ground (3:1 for a button, a ring or an icon) and turned into text that reads on each tone's
grounds. A colour that doesn't read as text is mixed toward the ground's body text until it does; the colour itself
stays for fills. Also the label colour that reads on each accent as a fill.

## Proposed pairs

Every text-on-ground pair the theme can draw from the brand: the body, heading and secondary text on each ground, each
accent as text, each label on its accent. Each with both colours and its ratio, at least 4.5:1 (WCAG AA for text); a
pair under that is listed below the table as not proposed. These are the pairs `design/contrast.json` declares.

## Fonts

The body and heading font stacks, the font files uploaded to the brand kit (each face's path in the theme,
`assets/fonts/<name>.woff2`, and where it comes from), and the rules a theme's fonts follow: one face a file, a licence
beside it, a family name that starts with the theme's class.

## Logo variants

The logo, the logo for dark grounds, the one-colour logo and the square mark: each uploaded, a link or not set, and the
file it becomes in the theme (`assets/brand/<variant>.png`, PNG or WebP). The logo's clear space when the kit sets it.

## Voice

The tone words and what each means, the phrases never to write, and the sign-off. The theme's own strings follow them.

## Theme

What the brand kit can't decide, to finish by hand before any code: a suggested name from the brand's name (the id's
second half, the `htmlClass`), the tones the grounds give (one preset at least on each, `"tone": "from-look"` when there
are two), and what is still to decide: the publisher, `base`, `minWidth`, the pages, the routes, the slots and the
mascot.
