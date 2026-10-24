# Auto's states, with no mascot

This theme was made with `automatos-theme new --template full --mascot none`: it draws no mascot, so it bundles
none of the kit's mascot package. Its chat still says what Auto, the AI, is doing (the captions, the tool lines, the
end of a turn), from the states the chat's events give him. The modules that work those out are copied here from the
kit's `packages/mascot/src`, under the kit's licence (Apache-2.0):

| File | What it does here |
|---|---|
| `events.ts` | The chat's status and reply as Auto's events |
| `reducer.ts`, `types.ts` | Auto's state machine and its states |
| `tools.ts` | What a tool call is (searching, reading, working) |
| `media.ts` | The caption for each state (its clip and still addresses go unused) |
| `player.ts` | When a one-shot state (his hello, a celebration) ends |
| `ring.ts` | The ring's tone for each state, which the style sheet's data still names |

`src/components/mascot/auto-mascot.tsx` draws his caption alone. To give the theme a mascot again, depend on the
kit's mascot package, draw him there, and add his clips and theme.json's `mascot` block.
