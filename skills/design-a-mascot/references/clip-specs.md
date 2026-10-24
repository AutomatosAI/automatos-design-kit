# Clips and stills

What a mascot's files must be for the package to be accepted, and what each browser needs for the clips to show on a
transparent ground. The reader is `automatos-theme pack` and `automatos-theme check`, which check every file as core's
`orchestrator/services/themes/package.py` does (`packages/theme-cli/src/files.ts`).

## The files and their caps

| File | Kind | Cap | The reader checks |
|---|---|---|---|
| `assets/mascot/<state>.webm` | clip | 1024 KB | its first bytes are WebM's header (`1A 45 DF A3`) |
| `assets/mascot/<state>.mp4` | clip | 1024 KB | an `ftyp` box at byte 4 |
| `assets/mascot/<state>.png` | still | 512 KB | the PNG signature |
| the whole package | package | 10 MB | the `.autotheme` file's own size |

- A clip over its cap is `CLIP_TOO_LARGE`, a still over its cap `FILE_TOO_LARGE`, bytes that are not what the name
  says `BAD_FILE_TYPE`, and a package over its cap `PACKAGE_TOO_LARGE`.
- Only these three kinds live in `assets/mascot/`: any other file there is `NOT_ALLOWED`, and an SVG anywhere is
  `SVG_NOT_ALLOWED`.
- 1024 KB is the server's default clip cap (core's `contract.py` `CAP_SETTINGS`); a server can be set to another.
  The still's cap is fixed.
- The caps are per file, and the package's is for everything: twelve states at the full caps would be 30 MB. Budget
  the mascot with the code (JS plus CSS at most 3 MB), the fonts and the previews. Play's 36 files come to about 4 MB.

## What the reader does not check

The reader reads a file's first bytes and its size, nothing more: never its codec, its alpha channel, its size in
pixels or its length. A clip with the wrong codec packs and passes `check`, then shows as a black box, or not at
all. And it never checks that a state has its web files: only `mobile.mascot` makes it look (below). Hold every
state's three files in the theme's own test.

## Codecs

| File | Codec | Who plays it |
|---|---|---|
| `.webm` | VP9 alpha: VP9 with its alpha channel | Chrome, Firefox, Edge, Opera, Android and every browser but Safari and iOS |
| `.mp4` | HEVC alpha: HEVC with its alpha channel | Safari on macOS, and every browser on iOS and iPadOS |

- `videoFormat` (`packages/mascot/src/media.ts`) chooses by the browser, from its user agent and its touch points,
  never by `canPlayType`: each browser can play the other file too, but drops its alpha channel and shows a black
  box. iPadOS asking for a desktop site reports a Mac; its touch points give it away.
- The host answers a byte range for a theme file, which Safari needs to play an `.mp4` (core's `ranges.py`): nothing
  to do in the theme.
- Give the still an alpha channel too: it is the clip's poster, drawn on the same ground.

## Length and size

Every clip is 5 s (`CLIP_MS` in `packages/mascot/src/player.ts`): the player swaps clips at that boundary, and a
one-shot lasts that long when no video plays. Play's clips are 512 by 512 pixels with no sound track; its `.webm`
files are VP9 with alpha, its `.mp4` files HEVC (`hvc1`), and its stills 512 by 512 PNGs with alpha. Those are Play's
choices, not caps.

## The phone

`theme.json` `mobile.mascot` says what a phone draws ([guides/contract.md](../../../guides/contract.md), "The `mobile`
block"); a phone runs none of the theme's code.

| `mobile.mascot` | The package needs, for every state in `mascot.states` |
|---|---|
| `clips` | `<state>.mp4` and `<state>.png` |
| `stills` | `<state>.png` |
| `none`, or no field | nothing |

A missing file is `MISSING_FILE`; `clips` or `stills` without the top-level `mascot` and its states is `BAD_MOBILE`.
The host gives the phone each state's name with its `.png` and, under `clips`, its `.mp4`; never the `.webm`, which
is the web's.
