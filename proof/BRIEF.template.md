# Brief: <theme name>

The sections a proof brief has, in this order. The launcher copies the brief into the run's clone as
`proof/<id>/BRIEF.md`, and the brief is all the run is told about the theme, so it says what to build, never how the
kit builds it: a step the kit should have taught is a gap the proof is there to find. A proof branch is public, so
the brief names no real customer, person, private product or unreleased plan. A branded theme may start from a brief
`automatos-theme brief` wrote from a made-up brand kit: keep its sections, then add the ones below it lacks.

## Theme

The theme's id (`<publisher>/<name>`, as `automatos-theme new` takes it), its display name and one sentence on what
it is for. The name is also the theme's folder (`themes/<name>/`), the proof's `--slug`, and its class on `<html>`.

## Look and feel

What it should feel like and look like: the mood, the grounds and accents, the type, the density, the motion. Words
and colour values are both fine; reference pictures are not (the run reads text only).

## Frame and pages

What wraps the host's pages (the frame), which core pages the theme replaces and how, which pages it adds as its
own routes, which placement slots it fills, its `base` (`studio` or `classic`) and its narrowest width (`minWidth`).

## Looks

The knobs a person can turn in the look editor, the presets (one at least for each tone the theme supports) and any
colour pairs that must read at WCAG AA.

## Mascot

None, Auto, or the theme's own: if one, where it sits and what it shows in each state.

## Phone skin

Whether the theme carries a phone skin (`theme.json`'s `mobile` block) for Automatos Go, and what it should look
like. "None" is a valid answer.

## Out of scope

What the run should not attempt.

## Done when

What the owner will check beyond the protocol's own list (`proof/README.md`): the pages, routes and looks that must
work, each in a sentence.
