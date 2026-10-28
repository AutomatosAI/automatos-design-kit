# Design references

Two finished interface designs to learn from: how a theme's screens, layout rules, Looks and mascot slot fit
together. Both were made for the Play pilot, before installable themes, so they are references, not theme packages:
nothing here is built, packed, linted or shipped, and no package may import from this folder.

| Folder | What it is |
|---|---|
| `designs/ember/` | Ember, the design Play (`themes/play`) was built from: nine screens at desktop and phone width, the style sheet, the Looks prototype, the mascot slot, and PNGs of the screens in `screens/`. |
| `designs/command/` | Command, a voice-first HUD interface: the core screen with its Looks drawer, five more pages (one per preset), the mascot slot, and its Looks, as designed (`looks.json`) and in look schema v1 (`looks/`). |

Each folder's `README.md` is the design's own brief. Rules in it that described the pilot's standalone app are marked
**Obsolete**, each with today's rule beside it; where a brief and `AGENTS.md` disagree, `AGENTS.md` wins. The people,
chats, prices, files and spend in the mocks are made up.

## Known gap: the `.dc.html` files do not open

Every `.dc.html` file loads `./support.js`, the runtime Claude Design generates beside the files it exports, and
relies on it to fill in its templates. This kit does not ship it (its licence is unclear), so the files do not render
as designed in a browser. Read them as source:

- The markup and its inline styles hold the layout and the type. `Automatos Command Pages.dc.html` is static markup
  only.
- In the other files, `{{ … }}` holes, `<sc-for>` lists and `<sc-if>` branches are filled from the `Component` class
  in the `<script type="text/x-dc">` block at the end of the file; its fields hold the data (Command's accents,
  grounds, fonts and presets, for example).
- `<dc-import name="Mascot">` places `Mascot.dc.html` with the attributes as its props.

Ember's `screens/` shows its screens as drawn. Command has no screenshots.

## Where they came from

Copied from the pilot's design files, byte for byte, except:

- `support.js` is left out (above).
- `designs/ember/Automatos Play Ember.dc.html`: the header linked to a design-direction file that is not in this
  kit; the link is now plain text ("direction 2b").
- Both `README.md` files: a note at the top, the **Obsolete** marks with today's rules, the `support.js` and mascot
  lines, and Ember's file table (its `screens/` row).
- `designs/command/looks/` is new: `looks.json` converted to look schema v1 (below).

## Command's Looks in look schema v1

`designs/command/looks.json` is the Look schema as designed (`automatos-interface-look/v0`): `accent`, `ground` and
`font` are keyed choices with their values (hex and ink, ground colour, font metrics), `grid` (0 to 30) and `glow`
(0 to 40) are numbers, and `scan`, `auto` and `motion` are booleans. A theme package's looks use
`automatos-look-schema/v1`, which has two knob kinds only, choices and numbers. So `designs/command/looks/` holds:

- `schema.json`: `accent`, `ground` and `font` as choice knobs over the same keys; `grid` and `glow` as whole-number
  knobs over the same ranges; `scan`, `auto` and `motion` as choice knobs `on` / `off`. Each knob's default is its
  value in `arc`, the default preset. The labels are the Looks drawer's.
- `presets/<id>.look.json`: the five presets, each knob's value equal to `looks.json`'s (`true` is `on`, `false` is
  `off`), with the look's `schema`, `interface`, `id`, `name` and an empty `sub`.

The values behind each choice (colours, font metrics) and the fixed colours have no place in a look; a theme keeps
them in its own code, as Play does.

## What the tests hold

`tests/references.test.ts` checks that the converted schema and presets pass the kit's copy of core's look
validators and equal `looks.json` value for value; that Command's brief marks each obsolete ground rule; that no file
here is over 2 MB; and that no file outside `references/` names `designs/command`, so that folder can be taken out
without breaking anything else. The one exception is the proof's leak list (`proof/leak-paths.txt`), which names it
so a proof run's launcher can take it out (with this test) before the run starts.
