/**
 * The demo extras: made-up data the harness's address can add to its sample data, `demo=<extra>,<extra>` (read and
 * written by src/host/router.ts; no toolbar control sets it), for the showcase shots (src/host/showcase.ts). With none,
 * the default, the fake host answers as the regression shots draw it. No DOM and no React, so the shots spec (Node)
 * reads the same names; src/host/demo-data.ts holds the data and gives it to the fake host.
 *
 * - `healthy-agents`: every agent of the roster active, where the sample roster (fixtures/agents/roster.json) also has
 *   an inactive one and one no CLI host can run, for the panels that list them.
 * - `older-chats`: the backend holds five older conversations too (fixtures/conversations/showcase.json), beside the
 *   transcript or a new chat, so a theme's conversation list reads as a workspace in use.
 * - `approval-turn`: the next thing the member sends is answered with the recorded turn that raises an approval with
 *   its approval view (fixtures/streams/turns.json `approvalView`: a send to the parents' group, waiting for the
 *   member), so a showcase shot can draw the host's approval card where the theme places it (src/host/showcase.ts).
 * - `hello-played`: Play's hello has played earlier in this tab's session (theme state HELLO_KEY, true, for this
 *   session and the account, as themes/play/src/lib/mascot/session.ts keeps it and Play's own tests mark it), so a chat
 *   opens with Auto at rest.
 */

export const DEMO_EXTRAS = Object.freeze(['healthy-agents', 'older-chats', 'approval-turn', 'hello-played'] as const)
export type DemoExtra = (typeof DEMO_EXTRAS)[number]

/** None: the sample data alone. */
export const NO_DEMO: readonly DemoExtra[] = Object.freeze([])

/** Play's hello in theme state (themes/play/src/lib/mascot/session.ts HELLO_KEY and HELLO_STATE). */
export const HELLO_KEY = 'hello-played'
export const HELLO_STATE = Object.freeze({ lifetime: 'session', within: 'account' } as const)

const SEPARATOR = ','

/** The extras a `demo=` value names, in DEMO_EXTRAS' order, each once; a name it doesn't know is dropped. */
export function demoOf(value: string | null): readonly DemoExtra[] {
  if (value === null) return NO_DEMO
  const named = new Set(value.split(SEPARATOR))
  return Object.freeze(DEMO_EXTRAS.filter((extra) => named.has(extra)))
}

/** The `demo=` value for `extras`, in DEMO_EXTRAS' order, each once; '' for none. */
export function demoText(extras: readonly DemoExtra[]): string {
  return DEMO_EXTRAS.filter((extra) => extras.includes(extra)).join(SEPARATOR)
}
