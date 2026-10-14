# The mascot

A skin may bring a companion into Studio's chat (PRD-259 §6): it reacts to what Auto is doing, driven by the chat stream Studio already reads. Each user can hide it.

```json
"mascot": { "mode": "off" }
"mascot": { "mode": "auto", "shell": "bronze", "light": "mint" }
"mascot": { "mode": "custom", "light": "mint" }
```

- **`off`:** no companion (Neon).
- **`auto`:** Auto, the built-in mascot. His clips ship with Studio, so the skin carries no files. `shell` tints his body: `bronze`, `gold`, `silver` or `cobalt`. `light` colours his eyes and the ring under him: one of Auto's four lights, by name: `mint`, `amber`, `ice` or `rose` (`MASCOT_LIGHTS`, the core's S-001 list). A colour value is refused.
- **`custom`:** your own character: the 36 files below in `assets/mascot/`. `light` colours the ring.

## The 12 states

Every set has the same 12 states (`MASCOT_STATES`, `lib/mascot/types.ts`). Two play once and hand back to `idle`; the rest loop.

| State | Plays | When |
|---|---|---|
| `hello` | once | the chat opens for the first time in a session |
| `idle` | loop | nothing is happening (the default) |
| `listening` | loop | the user is typing, or Auto has asked something and waits |
| `thinking` | loop | the message is sent and nothing has come back yet |
| `working` | loop | a tool is running |
| `searching` | loop | a web or Marketplace search |
| `reading` | loop | a document, knowledge or memory tool |
| `celebrate` | once | a turn finished with something done, or a Deliverable appeared |
| `oops` | loop | an error or a refused action |
| `sleeping` | loop | three minutes with no input, or Automatos is unreachable |
| `lost` | loop | the page wasn't found |
| `loading` | loop | a slow first load |

The player switches state at the end of a clip, never mid-clip, so **every clip must start and end on the same rest pose**: then any state can follow any other without a jump.

## The files (custom mode)

Three files per state, 36 in all, in `assets/mascot/`:

```
assets/mascot/<state>.webm   VP9 with alpha: Chrome, Edge, Firefox
assets/mascot/<state>.mp4    HEVC with alpha (hvc1): Safari and every iOS browser
assets/mascot/<state>.png    a transparent still: the poster, and what shows under reduced motion
```

- Each file is checked by its first bytes, not its name. A missing state or format refuses the whole set; the editor lists what is still missing.
- **All 36 files together at most 8 MB.** Auto's own set is about 4.5 MB: 512 × 512 px, 24 fps, 5-second clips, no sound.
- Both videos are needed: the wrong one for a browser shows a black box where the transparency should be.

In the editor: Mascot → Custom, then drop the files or a folder; the state picker plays each one.

## Making a set: the pipeline Auto was made with

Auto was made on 13 Oct 2026 in four steps. The tools and keys stay with you: the kit doesn't generate mascots, and no key ever goes into this repo or a skin.

1. **A hero image.** One still of the character at rest, square (Auto: 1:1 at 1k, Higgsfield's `nano_banana_pro`), on a plain dark background that contrasts with the character, so the cut-out has clean edges. Ask for no text and no logos. This pose is the first and last frame of every clip.
2. **Twelve clips, one per state.** Image to video, 5 s each, sound off (Auto: Kling 3.0 Pro image-to-video through the Higgsfield API, about $0.56 a clip). Give the hero as **both the start and the end image**, so each clip begins and ends on the same pose. Each prompt describes the state's motion and ends with the same fixed suffix: static camera, same size, same background, same design, start and end on the rest pose. Auto's prompts, for the pattern:
   - `idle`: hovers in place, bobbing gently, blinks slowly once.
   - `thinking`: looks up and to the side, eyes drift left and right, one arm to the chin, then settles back.
   - `searching`: turns its head left, then right, eyes sweeping like searchlights, then faces forward.
   - `oops`: tilts its head, eyes shrink and flicker, a small apologetic shrug, then settles back.
   - `loading`: one slow, even turn around its vertical axis, ending facing forward.
3. **Cut out the background,** frame by frame, on the device. Auto used Apple Vision's subject lifting (`VNGenerateForegroundInstanceMaskRequest`, macOS 14+, free and offline), which also removed the light ring under him; the page draws the ring instead. Retry a frame that fails: the model sometimes fails to load the first time.
4. **Encode.** Frames at 24 fps and 512 px, then the cut-out, then:
   ```sh
   ffmpeg -framerate 24 -i cut/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -row-mt 1 -an <state>.webm
   ffmpeg -framerate 24 -i cut/%04d.png -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.8 -q:v 60 -tag:v hvc1 -movflags +faststart -an <state>.mp4
   cp cut/0001.png <state>.png
   ```
   HEVC with alpha needs macOS's VideoToolbox encoder.

### Checks after a new clip

- **Seam:** compare the first and last frames, e.g. `ffmpeg -i first.png -i last.png -lavfi psnr -f null -`. Auto's clips scored about 47 dB: effectively identical. A low score means a visible jump at every loop.
- **Edges:** put a few cut frames over a bright colour and look at fine detail (Auto's metal and visor).
- **Motion:** look at a mid-clip frame. Subtle prompts give clips that barely move (Auto's `listening`, `working` and `oops` came out subtle).

## Rights

You ship these files to everyone who installs the skin. Make sure you own them or may share them: check the terms of every tool you used. Auto's rights are settled for Studio (PRD-259 §10); his files are not in this repository (`NOTICE`) and are copied into `public/auto/` by hand to see him in the kit.
