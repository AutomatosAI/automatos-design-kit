# @automatos/theme-rules

The JS rules the Automatos Marketplace review runs on a theme package's `source/` (`scripts/review/`), as one
table exported as data, so every tool that reads a theme's source can apply the same rules.

```ts
import { fileFindings, jsRuleFindings, RULES } from '@automatos/theme-rules'

fileFindings('source/entry.ts', text) // the findings in one script
jsRuleFindings(files)                 // the findings across a package's source/ scripts, in path order
RULES                                 // the text rules, as data
```

## The table

`RULES` is a frozen list of rows `{code, severity, pattern, message}`. Every match of `pattern` (a global
`RegExp`) in a script's text is a finding with that code and message. Every reader shares the pattern: read it
with `matchAll`, which copies it, never `test` or `exec`, which move its `lastIndex`.

Beside the table, the module checks what a pattern can't: import specifiers (`@/`, `next/*`, and what
`@automatos/vite-preset` refuses), paths that are absolute or leave `source/`, `import()` of a URL or a computed
value, and minified or obfuscated source. Those findings are errors.

A finding is `{code, severity, path, line, message, excerpt}`; the excerpt is the line, plain and cut short.

- `error`: refuses the package. Network calls, browser storage (a theme keeps state through the SDK's storage
  area), `eval`, created `<script>` or `<iframe>`, writes to `location`, bundled React and the rest, and audio the
  theme captures or makes by itself (theme voice, SDK 1.2.0): `getUserMedia`, `webkitGetUserMedia` and
  `mozGetUserMedia` (`JS_GET_USER_MEDIA`: a theme that opens the microphone or camera can record the person using
  it), `SpeechRecognition` and `webkitSpeechRecognition` (`JS_SPEECH_RECOGNITION`: a theme that listens can send
  the microphone's audio to the browser vendor's speech service) and `speechSynthesis` (`JS_SPEECH_SYNTHESIS`: a
  theme that speaks can speak as Auto with no AI notice). Each message says to use the SDK's voice area instead
  (`voice.VoiceButton`, `useVoice`, `readVoiceLevels`), whose names are never refused.
- `warning`: reported for the reviewer to read; refuses nothing. No row warns today; the severity stays for a row
  that should.

The three audio rows are core's own patterns (`orchestrator/services/themes/audio_capture.py`, `AUDIO_APIS`, which
blocks the same names in a package's bundle), so the kit and core catch the same code: each name as a whole
identifier, not inside a longer one (no letter, number, `_` or `$` on either side, letters and numbers of any
script, as Python reads `\w`), in calls, property reads, strings and comments alike. `AUDIO_CAPTURE_SEVERITY` is
their one severity, as `AUDIO_CAPTURE_LEVEL` is core's.

The rules read the text, comments and strings included: a name in a comment is still reported, and the reviewer
reads the line. They are a lint for honest authors and can be bypassed; the person who reviews every version is
the control.
