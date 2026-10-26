/**
 * The `audioCapture` check gives core's answers: the cases of core's orchestrator/tests/
 * test_theme_voice_audio_capture.py at the commit src/core/README.md names (theme voice, TV-C7). The code the browser
 * runs (dist/entry.js, dist/chunks/*.js) naming getUserMedia (and its prefixed names), SpeechRecognition or
 * webkitSpeechRecognition, or speechSynthesis is an error, one finding per name and file in the LLM stage's shape and
 * one sentence per name; the verdict is blocked. A longer identifier that only contains a name, the SDK's own voice
 * area, a style sheet and source/ are no finding.
 */
import { describe, expect, it } from 'vitest'
import {
  AUDIO_CAPTURE_LEVEL, AUDIO_REASON, audioCaptureCheck, describeAudio, EVIDENCE_MAX, FINDING_CATEGORY, FINDING_SEVERITY, NO_AUDIO,
} from '../src/check/audio.ts'
import { entryImporting, HELLO_ENTRY, reviewHello, reviewOnThisHost, SDK_IMPORT } from './check-support.ts'

const ENTRY = 'dist/entry.js'
const CHUNK = 'dist/chunks/voice.js'
const FINDING_KEYS = ['category', 'description', 'evidence', 'file', 'severity']
const DOES: Readonly<Record<string, string>> = {
  getUserMedia: 'opens the microphone', SpeechRecognition: 'listens to the microphone', speechSynthesis: 'speaks',
}

function check(files: Readonly<Record<string, string>>) {
  return audioCaptureCheck(new Map(Object.entries(files).map(([path, text]): [string, Uint8Array] => [path, new TextEncoder().encode(text)])))
}

const problem = (api: string, files: string): string => (
  `The code uses ${api} itself, which ${DOES[api]}, in ${files}. Use the SDK's voice area instead.`
)

describe('the check on its own', () => {
  it.each([
    ['const s = await navigator.mediaDevices.getUserMedia({ audio: true })', 'getUserMedia'],
    ['const { getUserMedia } = navigator.mediaDevices', 'getUserMedia'],
    ['navigator.webkitGetUserMedia({ audio: true }, ok, fail)', 'getUserMedia'],
    ['const listener = new SpeechRecognition()', 'SpeechRecognition'],
    ['const Listener = window.SpeechRecognition || window.webkitSpeechRecognition', 'SpeechRecognition'],
    ["window.speechSynthesis.speak(new SpeechSynthesisUtterance('hi'))", 'speechSynthesis'],
    ['const api = window["speechSynthesis"]', 'speechSynthesis'],
  ])('%s is an error naming %s', (code, api) => {
    const entry = check({ [ENTRY]: code })
    expect([entry.level, entry.status, entry.apis]).toEqual([AUDIO_CAPTURE_LEVEL, 'checked', [api]])
    expect(AUDIO_CAPTURE_LEVEL).toBe('error')
    expect(entry.problems).toEqual([problem(api, ENTRY)])
    expect(entry.reason).toBe(AUDIO_REASON)
    expect(describeAudio(entry)).toEqual({ text: AUDIO_REASON, items: entry.problems })
  })

  it("gives a finding per name and file, in the LLM stage's shape, in file order", () => {
    const entry = check({ [ENTRY]: 'navigator.mediaDevices.getUserMedia({ audio: true })', [CHUNK]: 'speechSynthesis.cancel()' })
    expect(entry.apis).toEqual(['getUserMedia', 'speechSynthesis'])
    expect(entry.findings.map((finding) => [finding.file, finding.category])).toEqual([[CHUNK, FINDING_CATEGORY], [ENTRY, FINDING_CATEGORY]])
    entry.findings.forEach((finding) => {
      expect(Object.keys(finding).sort()).toEqual(FINDING_KEYS)
      expect(finding.severity).toBe(FINDING_SEVERITY)
      expect(finding.evidence.length).toBeLessThanOrEqual(EVIDENCE_MAX)
    })
    expect(entry.findings[1]?.evidence).toContain('getUserMedia')
    expect(entry.findings[0]?.description.startsWith('Uses speechSynthesis itself')).toBe(true)
  })

  it('gives one sentence per name, listing every file that names it', () => {
    const entry = check({ [ENTRY]: 'new webkitSpeechRecognition()', [CHUNK]: 'new SpeechRecognition()' })
    expect(entry.apis).toEqual(['SpeechRecognition'])
    expect(entry.problems).toHaveLength(1)
    expect(entry.problems[0]).toContain(`in ${CHUNK}, ${ENTRY}.`)
    expect(entry.findings).toHaveLength(2)
    expect(entry.findings.map((finding) => finding.description.split(' itself')[0])).toEqual(['Uses SpeechRecognition', 'Uses webkitSpeechRecognition'])
  })

  it('cuts the evidence to the name and 60 characters either side', () => {
    const entry = check({ [ENTRY]: `${'a'.repeat(100)};speechSynthesis;${'b'.repeat(100)}` })
    expect(entry.findings[0]?.evidence).toBe(`${'a'.repeat(59)};speechSynthesis;${'b'.repeat(59)}`)
  })

  it.each([
    [{ [ENTRY]: HELLO_ENTRY }],
    [{ [ENTRY]: "import { VoiceButton, useVoice, readVoiceLevels } from '@automatos/theme-sdk'\nexport const v = [VoiceButton, useVoice, readVoiceLevels]" }],
    [{ [ENTRY]: 'const mySpeechSynthesisShim = 1; const getUserMediaLater = 2; const SpeechRecognitionEvents = 3' }],
    [{ [ENTRY]: HELLO_ENTRY, 'dist/theme.css': 'html.hello .speechSynthesis { color: red }' }],
    [{ [ENTRY]: HELLO_ENTRY, 'source/voice.ts': 'navigator.mediaDevices.getUserMedia({ audio: true })' }],
  ])('has no finding for the SDK voice area, a lookalike name or code the browser never runs (%#)', (files) => {
    const entry = check(files)
    expect([entry.level, entry.apis, entry.problems, entry.findings, entry.reason]).toEqual(['pass', [], [], [], null])
    expect(describeAudio(entry)).toEqual({ text: NO_AUDIO, items: [] })
  })
})

describe('in the review', () => {
  it('blocks a theme that opens the microphone itself', async () => {
    const entry = `${HELLO_ENTRY}\nexport const listen = () => navigator.mediaDevices.getUserMedia({ audio: true })\n`
    const { report, texts } = await reviewHello({ entry })
    const audio = report.checks.audioCapture
    expect([report.verdict, audio.level, audio.apis]).toEqual(['blocked', 'error', ['getUserMedia']])
    expect(report.summary.error).toBe(1)
    expect(texts.audioCapture).toEqual({ text: AUDIO_REASON, items: [problem('getUserMedia', ENTRY)] })
  })

  it("passes a theme on the SDK's voice area, on this host's SDK", async () => {
    const entry = `${entryImporting('defineTheme, VoiceButton, useVoice')}\nexport const talk = () => [VoiceButton, useVoice]\n`
    const manifest = { uses: ['theme', 'voice'], engines: { automatos: '^1.1.0', sdk: '^1.2.0' } }
    const { report } = await reviewOnThisHost({ entry, manifest })
    expect([report.verdict, report.checks.audioCapture.level]).toEqual(['pass', 'pass'])
    expect(report.checks.uses.usedAreas).toEqual(['theme', 'voice'])
    expect(HELLO_ENTRY).toContain(SDK_IMPORT)
  })
})
