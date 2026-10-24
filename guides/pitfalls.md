# Pitfalls

What went wrong while Play was built and moved into a package, and what each rule or check in this kit now catches.
Each entry says what happens, what catches it, and what to do instead.

## Colour and contrast

**The accent as text on a light ground.** An accent that reads well as a fill can fail as text. Play's Molten accent
(`#FF6A1F`) is 2.49:1 on its Paper ground (`#F4EEE8`), and its error coral (`#FF6B6B`) 2.41:1: both under the 4.5:1
that text needs. Give every colour that shows as text its own text variable per ground, derived from the raw colour
until it reads (`readableOn` in `@automatos/look-kit`'s `contrast.ts`, `packages/look-kit/src/`, which Play bundles,
mixes it toward the ground's text in small steps until it reaches 4.8:1), and keep the raw colour for fills, rings
and icons. Paint the pair from the prepaint table and declare it in `design/contrast.json`:
`automatos-theme check design` measures it on every preset ([looks.md](looks.md)).

**A focus ring under 3:1.** The same accent drawn as a focus outline is 2.49:1 on Paper, under the 3:1 a focus
indicator needs. Draw outlines and input rings in the readable text variable; a soft halo may stay the raw accent.
Declare the ring's pair with `"min": 3`.

**A fixed colour outside the look.** A ring, a loading glow or a badge in a hard-coded colour reads on one ground and
vanishes on another. Derive it from the look (Play mixes its mascot's dusk ring from the ground's text and
background). Keep every literal colour in one catalogue file: Play's CSS guard test fails on a `#hex`, a colour
function of numbers or a named colour anywhere else, and allows a system colour only inside `forced-colors`.

**Your variable names are Studio's.** `--accent`, `--ring`, `--background` and the rest are Studio's HSL tokens, which
every host page reads. A theme variable with one of those names recolours the host's pages by accident, in the
wrong form. Prefix every variable of the theme's own (Play's are `--pl-*`) and paint Studio's tokens only on purpose,
as `H S% L%` triplets ([looks.md](looks.md), "Recolouring the host's pages").

## CSS

**Studio's element rules reach your elements.** Under `"base": "studio"`, `<html>` carries `studio` beside the theme's
class, so core's rules such as `.studio h1` apply inside the theme too and can outrank a component's own rule.
Write the type, inline code and sheet colours that must win under `html.<htmlClass>` so they outrank them; Play's CSS
guard test compares its rules with a copy of core's Studio element rules.

**`!important` is refused.** The scope check refuses it anywhere in `dist/theme.css`. To outrank a rule without it,
add specificity: Play's motion stop adds `:not(#play-none)`, an id no element has, which outranks every selector
without an id.

**A name outside the theme's class.** Every `@keyframes` name and `@font-face` family must start with
`<htmlClass>-`, and every selector must sit under `html.<htmlClass>` ([contract.md](contract.md), "CSS"). The kit's
preset puts every rule under the class and renames keyframes and font families when it builds, then checks the result
as the server does; a theme built some other way must do all three itself.

**Styling the approval cards.** No selector may name `data-protected-surface`, and the cards keep their own boxes
whatever a stylesheet says. A generic rule (`html.<htmlClass> button`) still matches the buttons inside them, and an
element drawn over them can cover them: the reviewer reads for both. Place the host's cards; never restyle or cover
them.

## Motion

**Motion that can't stop.** A clip that loops longer than five seconds needs a pause control beside it (WCAG 2.2.2).
Play's Pause Auto control keeps the choice through the SDK's `storage` area, and until the host knows the saved choice
Auto shows his still and the control is disabled, so nothing loops before the choice is read.

**Reduced motion.** `useMediaPreferences().reducedMotion` is true when the person asks for it, and always on the
server. Under an installed theme the host also marks `<html>` with `data-theme-motion="reduce"` and sets
`--theme-motion`: stop animations on that, not on a marker of your own.

## Code

**Reading data or keeping state outside the SDK.** The Marketplace review refuses a package whose `source/` calls
`fetch`, `XMLHttpRequest`, a `WebSocket` or an `EventSource`, touches `document.cookie` or the browser's storage, calls
`eval`, creates a `<script>` or `<iframe>`, or writes to `location`. Everything a theme needs comes through the SDK
([sdk.md](sdk.md)): data through the page areas, navigation through `useHostRouter` and `HostLink`, small state through
`storage`. A theme's `lint` runs the same rules (`@automatos/eslint-plugin`), so CI fails first.

**A name in a comment.** The review's rules read comments and strings too: a comment that mentions a refused call is
reported like the call. Say what the code does in other words.

**Imports the host doesn't serve.** `@/…` is core's alias and `next/*` is Next.js: neither exists for a theme. React
and the SDK come from the host's import map and must not be bundled. A library from `node_modules` is refused by the
preset's source guard: copy it into `src/vendor/` as source, with its licence.

**A build that needs its own config.** The review rebuilds `source/` with the kit's preset alone, with no
`tsconfig.json`, `package.json` or `vite.config.*`, and its `dist/` must match the package byte for byte. No path
aliases, no extra plugins, nothing from outside `src/`. Never write `source/` yourself: `pack` writes it from `src/`.

**Untrusted text as HTML.** Chat replies, Deliverables and imported files are untrusted. Render Markdown through
`cards.MarkdownView` and everything else as text; never set HTML from them.

**Drawing before the width is known.** `useThemeLayout()` is `pending` on the server and while the page hydrates:
render nothing of the theme then. Drawing both the host's version and the theme's for a render that one of them then
loses has shown two shells on one page.

## The chat and the AI label

**Hiding the AI label stops the chat.** The host draws "Auto is an AI" beside every chat and checks that a person can
see it. A theme rule that hides, fades, shrinks or moves it disables every composer inside `cards.AiLabelFence` and
says the theme hides the notice; Send and Try again refuse, sending nothing. Wrap only the composer in the fence
(the approval cards in a reply stay clickable), and leave room for the label.

**Sending from somewhere else.** Send called from a timer, or from a chat in the frame on a page with no label,
starts no turn. Send only from the chat page's composer.

## Releases

**A version number is spent once submitted.** The Marketplace refuses the same version with other bytes, or a lower
one. Raise `version` in `theme.json` for every change you submit, and rehearse with a throwaway theme id, never your
real one ([`docs/OFFICIAL-LISTING.md`](../docs/OFFICIAL-LISTING.md) shows how Play's are released).
