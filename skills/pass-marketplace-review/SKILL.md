---
name: pass-marketplace-review
description: Get an Automatos theme package through the Marketplace review - run the server's review checks in the kit with automatos-theme check, fix what the JS rules, the CSS scope check, the uses check and the reproducible build refuse, then submit the .autotheme with automatos-theme submit or the Marketplace's upload. Use when a theme is ready to share, when a submission is refused or comes back review required, or to read a review report.
---

# Pass the Marketplace review

Every version of a theme on the Marketplace is checked by the server, then read by a person before it is listed. The
kit runs the server's checks first, in the server's words, so a refusal never reaches the queue. This skill is the
last step of [build-automatos-theme](../build-automatos-theme/SKILL.md).

## What the review does

1. **The reader.** The server unpacks the `.autotheme` and checks every file as `automatos-theme pack` does: the
   allowed paths, the caps, `theme.json`, the looks, the first-paint table, the CSS scope
   ([guides/contract.md](../../guides/contract.md)). A refusal stores nothing.
2. **The automated stage.** Each check is `pass`, `warning`, `error` or `not_measured`, and the verdict is `blocked`
   when one is an error, `review_required` when one is a warning, else `pass`:
   - `sizes`, `cssScope`, `looks`: the reader's checks, with what they measured.
   - `uses`: the SDK names the bundle imports against `theme.json` `uses`. A name the SDK doesn't export is an error.
   - `audioCapture`: the bundle opening the microphone, listening or speaking by itself (`getUserMedia`,
     `SpeechRecognition`, `speechSynthesis`) is an error. Talk to Auto through the SDK's `voice` area.
   - `clonedFrom`: a cloned page whose core file has changed since is a warning.
   - `previews`: a preview that belongs to no preset is a warning. The listing keeps `theme.json`'s order, and its
     cover is the first preview listed.
   - `jsRules`: the JS rules over `source/` (below).
   - `contrast`: the server measures only the `mobile` block's colour pairs; check your own pairs with
     `automatos-theme check design`.
   - `llm`: a language model reads `source/` and `dist/` for code that takes data off the page. It runs on the server
     only; a package too large for its chunk cap is `review_required` with "LLM stage did not run".
3. **The person.** A reviewer reads the report and the code, and can run the kit's review job on the package
   (`theme-review.yml`): no network, the same checks, and a rebuild of `source/` with the kit's preset that must give
   `dist/` byte for byte.

## Before you submit

1. Build the theme, then run `automatos-theme check <theme folder> --rebuild`. It packs the folder exactly as `pack`
   does, runs the checks above (all but `llm`), rebuilds `source/` and compares it with `dist/`, and prints the
   verdict. Done when the verdict is `pass`, or every warning is one you can explain in the submission's notes.
2. Run `automatos-theme check design <theme folder>`: every declared colour pair on every preset.
3. Raise `version` in `theme.json`. A version once submitted is spent: the same version with other bytes, or a lower
   one, is refused. Rehearse with a throwaway theme id, never your real one.
4. Run `automatos-theme pack <theme folder> --out out` and keep the `.autotheme` and its `.sha256.json`.

## The JS rules

The rules read every script in `source/` as text, comments and strings included: a refused name in a comment is
reported like the call. An error refuses the package; a warning is listed for the reviewer (no rule warns today). The theme's `lint`
(`@automatos/eslint-plugin`) runs the same table, so CI fails on them first.

| Code | Refused | Do instead |
|---|---|---|
| `JS_FETCH`, `JS_XHR`, `JS_WEBSOCKET`, `JS_EVENTSOURCE`, `JS_SEND_BEACON` | Any network call | Read data through the SDK's areas ([guides/sdk.md](../../guides/sdk.md)) |
| `JS_LOCAL_STORAGE`, `JS_SESSION_STORAGE`, `JS_INDEXED_DB` | `JS_LOCAL_STORAGE` refuses localStorage; the other two the session store and the database | Keep small state through the SDK's `storage` area (`useThemeState`) |
| `JS_COOKIE` | `document.cookie` | The same `storage` area |
| `JS_EVAL`, `JS_NEW_FUNCTION` | Code built from text | Write the code |
| `JS_ELEMENT` | A created or written `<script>` or `<iframe>` | Components only |
| `JS_POST_MESSAGE`, `JS_SERVICE_WORKER`, `JS_WINDOW_OPEN` | Messages to other windows, a service worker, a new window | `HostLink` opens an `https` link in a new tab |
| `JS_LOCATION_WRITE` | Writing `location` | `useHostRouter`, `HostLink` |
| `JS_COMPUTED_GLOBAL` | A computed property of `window` or `globalThis` | Name what you read |
| `JS_BUNDLED_REACT` | React bundled into the theme | Leave React to the host's import map (the kit's preset does) |
| `JS_ALIAS_IMPORT`, `JS_NEXT_IMPORT`, `JS_IMPORT` | `@/…`, `next/*`, or another import the preset refuses | The SDK; outside code copied into `src/vendor/` |
| `JS_PATH_IMPORT` | An absolute path, or one that leaves `source/` | Relative paths inside `src/` |
| `JS_GET_USER_MEDIA`, `JS_SPEECH_RECOGNITION`, `JS_SPEECH_SYNTHESIS` | Audio of the theme's own: `getUserMedia` (the microphone or the camera), `SpeechRecognition`, `speechSynthesis` | The SDK's `voice` area: `VoiceButton`, `useVoice`, `readVoiceLevels` (SDK 1.2.0, [guides/sdk.md](../../guides/sdk.md)) |

Minified or obfuscated source, and an `import()` of a URL or a computed value, are errors too.

## What the reviewer reads for

The checks can't prove these, so the person reviewing does:

- the host's approval cards and AI label stay visible and clickable: no generic rule that restyles their buttons, no
  overlay over them, no code that moves them ([guides/pitfalls.md](../../guides/pitfalls.md));
- the frame shows the host's header utilities;
- untrusted text is drawn as text, Markdown only through `cards.MarkdownView`;
- the words: Auto, Mission, Deliverable, Playbook.

## Submit

- **The local edition:** `automatos-theme submit <file.autotheme>`, with `AUTOMATOS_API_URL` set to the API's
  address; the local edition needs no token. The command prints the server's answer: pending review, with the
  verdict and each check, or every reason it was refused.
- **The hosted edition:** upload the `.autotheme` in Marketplace › Themes › Publish theme. Hosted CLI auth is parked
  for now, so `submit` against a hosted API usually prints the server's 401 or 403.

A pending version is listed only after a person approves it. Follow the queue's answer: a note from the reviewer is
fixed in a new version, never by resubmitting the same one.

## Rules

- Fix the theme, never the check: no rule is switched off to pass.
- Never report a check as passed without having seen it pass, in `check`'s output or in CI.
