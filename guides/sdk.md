# The theme SDK

`@automatos/theme-sdk` is the one module a theme imports from the host. The host serves it through its import map
at run time, so a theme never bundles it; the kit vendors its type declarations in
[`packages/theme-sdk`](../packages/theme-sdk/README.md) (version 1.2.0). Everything a theme reads of the app, and
everything it asks the app to do, goes through these names: no `fetch`, no `@/…` import, no `next/*`, no browser
storage of its own ([pitfalls.md](pitfalls.md)).

The names below are the SDK's runtime surface by area, as core lists it in its `sdk-surface.json` (vendored in
[`packages/theme-cli/src/core/data/`](../packages/theme-cli/src/core/data/sdk-surface.json)); `tests/guides.test.ts`
holds this page to that file. Each area's types and comments are in `packages/theme-sdk/areas/<area>.d.ts`. Name the
areas the code imports in `theme.json` `uses`: `automatos-theme check` warns when the two disagree, and an import of
a name the SDK doesn't export is an error, because the theme could never load.

Hooks hand back small, frozen copies of the host's state. Outside the host's providers (and on the server) they
answer "unknown" (null, `ready: false`, `available: false`) rather than throw. In tests, `@automatos/theme-harness`
gives a fake of every name ([its README](../packages/theme-harness/README.md)).

## `theme`

| Name | What it is |
|---|---|
| `defineTheme` | Checks and freezes the theme's definition, `{ register(host), unregister? }`; the entry's default export. `register` gets `registerSlot`, `registerPage` and `registerRoute` ([contract.md](contract.md)). |
| `SDK_VERSION` | The version of the SDK the host serves. |

## `context`

| Name | What it is |
|---|---|
| `useWorkspace` | The workspace the page is in: id, name, slug, plan, and whether Socials is offered there; null while it loads. |
| `useRole` | The caller's workspace and platform roles, `isAdmin`, and `canEdit` (false for a viewer). |
| `useEdition` | `local` (one operator, no sign-in) or `saas`. |
| `useTrial` | The workspace's trial ledger, or null. |
| `useHealth` | Whether the backend answers, and `check()` to ask again; `{ poll: true }` makes the caller the page's one poller. |
| `useOnline` | Whether the browser is online. |
| `useMediaPreferences` | `reducedMotion` (always true on the server, so a first paint never animates). |
| `useTone` | The tone the page is painted in, or null before the host knows. |
| `useThemeLayout` | `theme` at or above `minWidth`, `fallback` below it, `pending` on the server and while hydrating (render nothing of the theme then). |

## `navigation`

| Name | What it is |
|---|---|
| `HostLink` | A link: the host's client-side link for a path in the app, a new tab for `https`, a TypeError for anything else. |
| `useHostRouter` | `push`, `replace`, `back`, `refresh`, `prefetch`, for paths inside the app only. |
| `useHostPathname` | The current path, without the query string. |
| `useHostSearchParams` | The query string, read only. |
| `useCoreNav` | The host's menu for this caller (after the edition, role and plan filters): `primary` and `footer` items. |
| `resolveActiveNavId` | The id of the menu item a path belongs to, or null. |
| `chatHref`, `missionHref`, `ticketHref`, `questionHref` | The path to one chat, Mission, board ticket, or question. |
| `CHAT_HREF`, `DELIVERABLES_HREF`, `DELIVERABLE_EXPLORER_HREF`, `BOARD_HREF`, `QUESTIONS_HREF`, `LOOKS_HREF`, `LOOK_STYLE_HREF` | The paths of the chat, the Deliverables page and its file explorer, the Command Center's board and questions tabs, the look editor and the style sheet. |
| `DELIVERABLE_PARAM` | The query parameter that opens one Deliverable on the Deliverables page. |

## `notices`

| Name | What it is |
|---|---|
| `notify` | Shows a text-only notice in the host's toaster (`message`, `success`, `info`, `warning`, `error`); returns its id. |
| `dismissNotice` | Dismisses one notice by id, or all of them. |

## `events`

| Name | What it is |
|---|---|
| `HOST_EVENT_NAMES` | The host events a theme may follow: `board-changed`, `chat-changed`. |
| `onHostEvent` | Calls a handler on every such event until the returned function is called. The detail is `unknown`: check it first. |
| `useHostEvent` | `onHostEvent` for a component's lifetime. |
| `openGlobalSearch` | Opens the host's global search. |

## `chat`

| Name | What it is |
|---|---|
| `useChatController` | The host's chat controller. Called with no argument in the chat page it gives the conversation on screen; called with that conversation in a child keyed by its `key` it gives the messages, the status, Send, Stop and Try again, the approvals and the turn's events. |
| `useConversationList` | The caller's conversations, newest first. |
| `useRecentChats` | The latest conversations for a sidebar, and the one on screen. |
| `useStartChat` | New chat: a fresh draft, then the chat page. |
| `receiptLine` | One receipt in the host's plain words, the same in every theme. |
| `receiptLink` | A done receipt's page, when it is a path in the app; else null. |
| `movedSomethingOnTheBoard` | Whether a done write touched a card on the board. |
| `liveReceiptsOf` | The turn's receipts off one of the stream parts `onData` hands over, as the reply will carry them. |

## `deliverables`

| Name | What it is |
|---|---|
| `useDeliverables` | The workspace's Deliverables, a page at a time. |
| `useDeliverable` | One Deliverable, with its text and file path when asked. |
| `useFileDownload` | Downloads a file with the caller's token; a failure shows a notice. |
| `useAuthenticatedBlobUrl` | A file the backend serves only with the caller's token, as a `blob:` URL. |
| `deliverableFileUrl`, `deliverableDownloadUrl`, `fileDownloadUrl` | The API path of a Deliverable's file, what Download fetches for it, and the raw route for a content route. |
| `deliverableFilename` | The file's name, else the last part of its path. |
| `deliverableLabel` | A kind's name ("Reports"). |
| `visibleDeliverableTabs` | The tabs this workspace shows (Socials only while it is offered). |
| `DELIVERABLE_FEED_FILTERS` | The feed's default filters: every Deliverable but a heartbeat's. |
| `DELIVERABLE_TAB_LABELS` | Each tab's name, as the host's tab strip shows it. |

## `cards`

The host's own components, which a theme places and never redraws. Their buttons make the host's calls.

| Name | What it is |
|---|---|
| `ToolApproval`, `MissionApproval` | The approval cards: protected surfaces that no theme CSS can hide ([contract.md](contract.md), "CSS"). |
| `TaskCard` | The live card for a board ticket. |
| `WithdrawOfferCard` | The offer to withdraw a request the owner said no to. |
| `MissionSuggestionCard`, `MissionCreatedCard` | The offer to turn the conversation into a Mission, and the Mission the chat created. |
| `FilePreview` | The host's preview of a file. |
| `MarkdownView` | The host's sanitising Markdown renderer: a theme never renders untrusted Markdown itself. |
| `MadeBy` | Who made a Deliverable. |
| `TrialExhaustedBanner` | The banner shown when the workspace's credits are used up. |
| `FirstRunNudge` | The local edition's first-run nudge. |
| `HeaderUtilities` | Help, notifications, the theme menu and the account. Every frame renders it. |
| `AiLabelFence` | The host's fence around a theme's chat composer: its controls are disabled while the host's AI label can't be seen. Wrap the composer only. |
| `CorePage` | The core page for this route inside the theme's page, or its children where there is none. |

## `looks`

| Name | What it is |
|---|---|
| `useLook` | The active look, the saved looks and their actions ([looks.md](looks.md)). |
| `saveLook` | Saves a look, or replaces the saved look with its id; a preset can't be saved over. |
| `listLooks` | The saved looks now, for an event handler. |
| `exportLook` | A look as a `.look.json` file to offer for download, or null. |
| `importLook` | Pasted text as a look ready to save, or why it is refused. |
| `useLookScope` | Whose looks these are (the signed-in user in this workspace), as one opaque string, or null until known. |

## `assets`

| Name | What it is |
|---|---|
| `assetUrl` | The URL of a file in the active theme's package (`assets/mascot/wave.mp4`), or null when the path is refused, no installed theme is the style, the host doesn't know the package yet, or on the server. |

## `storage`

Small per-user state a theme keeps through the host, never in the browser's storage directly. A key
(`^[a-z][a-z0-9-]{0,47}$`) holds a JSON value, kept for the active installed theme and the signed-in user
(`within: 'account'`, the default) or the user in this workspace (`'workspace'`), in this browser (`lifetime:
'browser'`, the default) or for the tab's session (`'session'`). Every theme runs on the host's origin, so this state
is scoped per theme and per account, not isolated: never keep a secret in it.

| Name | What it is |
|---|---|
| `useThemeState` | A key's state for a component, re-rendering when it changes: `ready`, `value`, `persisted`, `set`, `remove`. |
| `readThemeState` | A key's value now, for code outside a render. |
| `writeThemeState` | Keeps a value under a key, once it is JSON within the limits. |
| `removeThemeState` | Forgets a key. |
| `subscribeThemeState` | Calls a listener when a key's state may have changed. |
| `THEME_STATE_LIMITS` | The caps: 32 keys and 65,536 characters per theme blob, 32,768 per value, 8 levels deep, 8 blobs per lifetime. |

Outside a running installed theme a read answers `ready: false` and a write refuses with `not-ready`; on the server it
refuses with `unavailable`; with the browser's storage blocked a write answers `persisted: false` and the state lasts
for the page. Nothing throws: every refusal is `{ ok: false, reason, message }`.

## `voice`

Talking to Auto by voice, through the host (SDK 1.2.0: `engines.sdk` `^1.2.0`, and `voice` in `uses`). The host runs
the tab's one voice session: Auto Live (a call, on the plans that have it) or web quick-ask (hold to talk, on every
plan and edition). A theme never captures audio itself: code that names `getUserMedia`, `SpeechRecognition`,
`webkitSpeechRecognition` or `speechSynthesis` is refused by the Marketplace review and by the kit's lint
(`JS_GET_USER_MEDIA`, `JS_SPEECH_RECOGNITION`, `JS_SPEECH_SYNTHESIS`).

| Name | What it is |
|---|---|
| `VoiceButton` | The host's voice button: the press (`press`: `hold`, the default, or `toggle`), the engine (`mode`: `auto`, `quick` or `live`), the `conversation` it talks into, the `hotkey`, the `size` (`sm`, `md`, `lg`) and the `label`. While the session is the button's, the host draws the "AI voice assistant" caption and the stop control in a protected surface (`voice-control`) that no theme CSS can hide. Style it through `data-voice-state`, `data-voice-mode`, `data-voice-press`, `data-voice-size` and `data-voice-mic` on its root and the `--voice-button-*` custom properties. |
| `useVoice` | The session as a frozen snapshot: what is `available` (quick, live and the reason), the `mode`, the `phase` (`idle`, `connecting`, `listening`, `thinking`, `speaking`, `ended`, `error`), `micOpen`, `muted`, `heard`, `reply`, `durationSec`, `error`, `chatId`, and `stop()`. |
| `readVoiceLevels` | The member's and Auto's levels now, 0 to 1 (`user`, `agent`), for code inside an animation frame (a waveform, a mascot); zeros while no session runs. Never read it in a render. |

Outside the host's voice (a page with none) `useVoice` answers the idle snapshot with nothing available and the
reason, `readVoiceLevels` zeros, and `VoiceButton` is drawn disabled; none throws. A theme never hides the caption or
the stop control, and never rewords the AI notice the host speaks once per session.

## Page areas

The data the core pages read, for a theme's own or cloned version of them ([page-inventory.md](page-inventory.md)).
Each hook wraps the core hook the page reads, with the same endpoints, cache and polling, and hands back a frozen view:
a query is `{ data, isLoading, isFetching, error, refetch }` (data null until it answers, the error as its message),
an action `{ run, runAsync, isRunning, error, result, reset }`. An id the host can't use is refused before anything is
sent.

### `pages/agents` (`uses`: `pages-agents`)

| Name | What it is |
|---|---|
| `useAgents` | The workspace's agents, as the core roster lists them. |
| `useAgentStats` | The agent counts (total, active, inactive, by type). |

### `pages/assignments` (`uses`: `pages-assignments`)

| Name | What it is |
|---|---|
| `useMissions` | The workspace's Missions, polled as the core list is. |
| `useMission` | One Mission with its tasks and recent events. |
| `useMissionField`, `useFieldQuery` | A Mission's field (or the workspace's), and which of its patterns fire for a query. |
| `useRecommendedAssignments` | The recommended Playbooks and Missions. |
| `useApproveMission`, `useRejectMission` | Approve a Mission's plan, or reject it with the reason. |
| `usePauseMission`, `useResumeMission`, `useCancelMission` | Pause, resume or cancel a Mission. |
| `useReplanMission`, `useRerunMission` | Plan a failed Mission again; start a new one from a finished one. |
| `useSaveAsRoutine` | Save a Mission as a reusable routine. |
| `useUpdateMissionSettings` | Change a Mission's settings. |

### `pages/documents` (`uses`: `pages-documents`)

| Name | What it is |
|---|---|
| `useDocuments`, `useDocumentStats` | The knowledge documents (or one team's), and the totals. |
| `useUploadDocument`, `useDeleteDocument` | Upload a file into the knowledge base; delete a document. |
| `useTeams`, `useDocumentTeamCounts` | The workspace's teams, and how many documents each can read. |
| `useCloudConnections`, `useTriggerSync`, `useSelectRootFolder` | The connected cloud folders, a sync now, and the folder a connection syncs from. |
| `useDatabaseKnowledge` | The database sources and query templates, and the page's calls on them. |

### `pages/playbooks` (`uses`: `pages-playbooks`)

| Name | What it is |
|---|---|
| `useWorkflowPlaybooks`, `useWorkflowPlaybook` | The workspace's Playbooks, and one with its steps. |
| `usePlaybookExecutions` | A Playbook's runs, newest first. |
| `useCreatePlaybook`, `useUpdatePlaybook`, `useDeletePlaybook` | Create, change or delete a Playbook. |
| `useExecutePlaybook` | Run a Playbook now. |

### `pages/command-center` (`uses`: `pages-command-center`)

| Name | What it is |
|---|---|
| `useActivityFeed` | The workspace's runs (chats, routines, Playbooks, Missions, tasks), newest first. |
| `useActivityStats`, `useActivitySchedule` | The stats strip's numbers for a period; what runs next. |
| `useQuestions` | The open questions waiting for an answer. |
| `useNeedsYou` | The one Needs-you number and the rows behind it. |
| `useWatches` | The live watches. |
| `useBoardEventStream` | Keeps the board's event stream open while the page is mounted; its pushes arrive as `useHostEvent('board-changed')`. |
