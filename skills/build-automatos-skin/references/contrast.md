# Contrast

Every skin must be readable, in every tone it has. Studio checks it at upload (PRD-259 §3), and the kit checks it with the same rules in `npm run validate`, `npm run pack`, the editor's badges and Export (`lib/skins/validate-tokens.ts`, pairs in `CONTRAST_PAIRS`, `lib/skins/format.ts`).

## The pairs

WCAG 2.x contrast (relative luminance through sRGB). Text needs **4.5:1** (AA for body text); the focus ring needs **3:1** on the page (a non-text indicator).

| Text | On | At least |
|---|---|---|
| `foreground` | `background` | 4.5:1 |
| `card-foreground` | `card` | 4.5:1 |
| `popover-foreground` | `popover` | 4.5:1 |
| `primary-foreground` | `primary` | 4.5:1 |
| `secondary-foreground` | `secondary` | 4.5:1 |
| `muted-foreground` | `background` | 4.5:1 |
| `muted-foreground` | `card` | 4.5:1 |
| `accent-foreground` | `accent` | 4.5:1 |
| `destructive-foreground` | `destructive` | 4.5:1 |
| `success-foreground` | `success` | 4.5:1 |
| `warning-foreground` | `warning` | 4.5:1 |
| `info-foreground` | `info` | 4.5:1 |
| `agent-foreground` | `agent` | 4.5:1 |
| `ring` | `background` | 3:1 |

These are the 14 pairs of Studio's own validator (core S-001, `CONTRAST_PAIRS` in its `frontend/lib/skins/schema.ts`), in its order; the kit's list is the same constant. `olive`, `warn-ink` and `muted-foreground` on `muted` aren't pairs: set them freely, but keep them readable by eye.

A pair is checked in a tone, on the skin's own colours only, when the skin sets either of its two tokens there (decision K5). A failure reads `✗ $.tokens.<tone>.<text token>  In <tone>, <text> on <fill> is 3.31:1; text needs at least 4.5:1.` (ratios to two decimals, never rounded up).

**Set both sides of every pair you touch.** Setting one side alone is an error: `✗ $.tokens.light.primary-foreground  In light, setting primary needs primary-foreground too: they are checked as a pair, on the skin's own colours.` The base's colours are never used for the check, because the base can't be trusted: Studio's Classic palette itself fails `primary` (3.31:1 in light), `accent`, `destructive`, `success`, `info` and `agent` in both tones. A pair the skin leaves wholly to its base isn't checked at all, so a Classic skin needn't fix Classic's own pairs. Note that `muted-foreground` sits in two pairs: setting it needs `background` and `card` too.

## Making text readable

Keep the fill (your brand colour), move the text:

1. **Mix the text toward black or white,** whichever the fill contrasts with more, in small steps, until the pair clears its floor with a little margin. This is what the editor's "Use suggestion" does (`suggestReadable` in `lib/skins/suggest.ts`): 2% steps, aiming 0.3 above the floor (4.8:1 for text, 3.3:1 for the ring), falling back to pure black or white, which always passes.
2. **When the colour must stay recognisable as text** (a brand orange used for links or highlights), darken it on light grounds and lighten it on dark ones, keeping its hue. Daylight does this: molten `20.1 100% 56.1%` stays the `primary` fill with near-black text on it, while `accent` and `ring`, which show as text and edges, are molten darkened to `20.3 71.7% 38.8%`.
3. **A bright fill takes dark text.** Neon's arc cyan `primary` (`189.7 100% 62.4%`) carries `primary-foreground` `195 83.3% 4.7%`, not white.
4. **Status fills** (`success`, `warning`, `info`, `agent`, `destructive`) are the usual failures: mid-tone greens and ambers fail white text. Either darken the fill until white reads, or give it near-black text.

Check by number, not by eye: the editor shows every pair as a badge beside each colour, with the validator's verdict in a glyph and in words: `✓ AA pass` or `✗ AA fail` for a pair the skin sets both sides of, `! Incomplete pair` with a "Set … too" button for a pair it sets one side of, and `– Base colours, not checked` for a pair it leaves to the base. Setting a colour in the editor sets the other side of its pairs to the base's value, so a pair is never left half-set by accident. `npm run validate` is the final word.

## What contrast doesn't cover

Fills against each other (a card on the page, a border on a card) have no floor. Keep `border` visible on both `background` and `card`, and `muted` distinguishable from `background`, or panels melt into the page.
