// proof-audit's reading of a run's transcript (PRD-261 B-06a, proof/README.md): the stream-json a run writes (claude -p
// --output-format stream-json --verbose) as its events, its tool calls (a turn is one assistant message, counted from
// 1), the tool results the run was shown, and the run's numbers. Plain Node, no dependencies.

/** The transcript's events, one JSON object a line. Throws on a line that is not JSON. */
export function parseTranscript(text) {
  return text.split('\n').flatMap((line, index) => {
    if (line.trim() === '') return []
    try {
      return [JSON.parse(line)]
    } catch {
      throw new Error(`line ${index + 1} of the transcript is not JSON.`)
    }
  })
}

/** Every tool call in the events, in order, as { turn, id, tool, input }: a turn is one assistant message (its id). */
export function toolCalls(events) {
  const assistant = events.filter((event) => event?.type === 'assistant')
  const ids = assistant.map((event, index) => event.message?.id ?? `#${index}`)
  let turn = 0
  const turns = ids.map((id, index) => (turn += index > 0 && ids[index - 1] === id ? 0 : 1))
  return assistant.flatMap((event, index) => (Array.isArray(event.message?.content) ? event.message.content : [])
    .filter((block) => block?.type === 'tool_use')
    .map((block) => ({ turn: turns[index], id: typeof block.id === 'string' ? block.id : null, tool: String(block.name), input: block.input ?? {} })))
}

/** A tool result's text: its content when that is a string, or its text blocks joined by line breaks. */
function resultText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n')
}

/** Every tool result in the events, in order, as { turn, text }: the turn of the call it answers, or null when none does. */
export function toolResults(events) {
  const turnOf = new Map(toolCalls(events).filter((call) => call.id !== null).map((call) => [call.id, call.turn]))
  return events.filter((event) => event?.type === 'user' && Array.isArray(event.message?.content))
    .flatMap((event) => event.message.content.filter((block) => block?.type === 'tool_result')
      .map((block) => ({ turn: turnOf.get(block.tool_use_id) ?? null, text: resultText(block.content) })))
}

/** The run's numbers from its result line, or null when the transcript has none (the run did not finish). */
export function runSummary(events) {
  const result = [...events].reverse().find((event) => event?.type === 'result')
  if (result === undefined) return null
  return { turns: result.num_turns ?? null, costUsd: result.total_cost_usd ?? null, durationMs: result.duration_ms ?? null }
}
