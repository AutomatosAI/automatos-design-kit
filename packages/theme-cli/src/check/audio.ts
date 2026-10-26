/**
 * The `audioCapture` check (theme voice, TV-C7): core's orchestrator/services/themes/audio_capture.py at CORE_SHA.
 *
 * A theme talks to Auto by voice only through the SDK's voice area (VoiceButton, useVoice, readVoiceLevels, SDK
 * 1.2.0), which draws the AI voice caption and the stop control. The check reads the code the browser runs (dist/entry.js
 * and dist/chunks/*.js, uses.ts `bundleFiles`, as core's `bundle_texts`) for the browser's audio APIs as whole
 * identifiers, in calls, property reads, strings and comments alike: getUserMedia (and webkitGetUserMedia,
 * mozGetUserMedia), SpeechRecognition and webkitSpeechRecognition, and speechSynthesis. The names and patterns are
 * `@automatos/theme-rules`' AUDIO_APIS, the rows the JS rules refuse in source/, so the two catch the same code.
 *
 * Each name found in a file is one finding in the LLM stage's shape (category, severity, description, file, evidence),
 * in file order then API order, and each name one sentence in `problems` naming its files. Any finding makes the check
 * AUDIO_CAPTURE_LEVEL, an error, so the verdict is blocked; none makes it a pass.
 */
import { AUDIO_APIS, type AudioApi } from '@automatos/theme-rules'
import { LEVEL_ERROR, LEVEL_PASS, type CheckEntry, type CheckText, type Files, type Level } from './report.ts'
import { bundleFiles } from './uses.ts'

/** audio_capture.py AUDIO_CAPTURE_LEVEL: a warning instead is this one constant. */
export const AUDIO_CAPTURE_LEVEL: Level = LEVEL_ERROR
export const FINDING_CATEGORY = 'Audio capture'
export const FINDING_SEVERITY = 'high'
export const EVIDENCE_AROUND = 60
export const EVIDENCE_MAX = 300
const STATUS_CHECKED = 'checked'

export const AUDIO_REASON = (
  "A theme talks to Auto by voice only through the SDK's voice area (VoiceButton, useVoice), which "
  + "draws the AI voice caption and the stop control. Its code can't open the microphone, listen or "
  + 'speak by itself.'
)
const PROBLEM = "The code uses {api} itself, which {does}, in {files}. Use the SDK's voice area instead."
const DESCRIPTION = "Uses {found} itself: it {does} outside the host's voice, with no AI voice caption and no stop control."
/** What the line says when the bundle names none of the APIs (the kit's words). */
export const NO_AUDIO = "The bundle opens no microphone, listens to none and speaks by itself nowhere: its voice is the SDK's."

/** One finding, in the shape of the LLM stage's. */
export interface AudioFinding {
  readonly category: string
  readonly severity: string
  readonly description: string
  readonly file: string
  readonly evidence: string
}

export interface AudioEntry extends CheckEntry {
  readonly status: typeof STATUS_CHECKED
  readonly apis: readonly string[]
  readonly problems: readonly string[]
  readonly findings: readonly AudioFinding[]
  readonly reason: string | null
}

/** `template` with each `{field}` filled in (a function replacer, so no `$` in a value is read as a pattern). */
function filled(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, field: string) => values[field] ?? whole)
}

/** The first place `api` is named in `text`, or null (the pattern is global: read with matchAll, which copies it). */
function firstMatch(api: AudioApi, text: string): RegExpMatchArray | null {
  for (const match of text.matchAll(api.pattern)) return match
  return null
}

/** audio_capture.py `_evidence`: the match with EVIDENCE_AROUND characters either side, cut to EVIDENCE_MAX. */
function evidenceOf(text: string, match: RegExpMatchArray): string {
  const at = match.index ?? 0
  return text.slice(Math.max(at - EVIDENCE_AROUND, 0), at + match[0].length + EVIDENCE_AROUND).slice(0, EVIDENCE_MAX)
}

/** audio_capture.py `audio_capture_findings`: one per API per file that names it, in file order, then API order. */
export function audioCaptureFindings(texts: ReadonlyArray<readonly [string, string]>): AudioFinding[] {
  return texts.flatMap(([file, text]) => AUDIO_APIS.flatMap((api) => {
    const match = firstMatch(api, text)
    if (match === null) return []
    const description = filled(DESCRIPTION, { found: match[0], does: api.does })
    return [{ category: FINDING_CATEGORY, severity: FINDING_SEVERITY, description, file, evidence: evidenceOf(text, match) }]
  }))
}

/** audio_capture.py `audio_capture_check`: an error naming each audio API the bundle uses, else a pass. */
export function audioCaptureCheck(files: Files): AudioEntry {
  const texts = bundleFiles(files)
  const named = AUDIO_APIS
    .map((api) => ({ api, files: texts.filter(([, text]) => firstMatch(api, text) !== null).map(([file]) => file) }))
    .filter((entry) => entry.files.length > 0)
  const problems = named.map(({ api, files: where }) => filled(PROBLEM, { api: api.name, does: api.does, files: where.join(', ') }))
  const found = named.length > 0
  return {
    level: found ? AUDIO_CAPTURE_LEVEL : LEVEL_PASS,
    status: STATUS_CHECKED,
    apis: named.map(({ api }) => api.name),
    problems,
    findings: audioCaptureFindings(texts),
    reason: found ? AUDIO_REASON : null,
  }
}

/** The `audioCapture` line: core's reason and one sentence per API, or that the bundle names none. */
export function describeAudio(entry: AudioEntry): CheckText {
  return { text: entry.reason ?? NO_AUDIO, items: entry.problems }
}
