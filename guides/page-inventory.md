# Page inventory

The nine core pages a theme may replace ([contract.md](contract.md), "Pages"), what each reads through the SDK, the
core files a clone copies, and where Auto can reach the page without replacing it.

A clone records the file it copied and that file's sha256 in `clonedFrom`. The hashes of this host release are in
[`core-pages.json`](../packages/theme-cli/src/core/data/core-pages.json), a byte-for-byte copy of core's
`orchestrator/services/themes/data/core-pages.json`; `automatos-theme check` compares each clone's `sha` with it and
warns when core has changed the file since. Paths are relative to core's `frontend/`.

Slot reach is core's `docs/theme-host/placement-reach.md`, read from the code: under the Studio base most of these
pages draw Studio components that use neither the shared header nor the shared empty state, so no placement slot
draws there ([mascot-placement.md](mascot-placement.md)).

## `/chat`: Chat

- Core files: `app/chat/page.tsx`, `components/chatbot/studio-chat-shell.tsx`.
- SDK: the `chat` area (`useChatController`, `useConversationList`, `useRecentChats`, `useStartChat`, the receipt
  helpers) and the `cards` area for the host's approval, task, withdraw and Mission cards and the AI label fence.
- Slots: none under either base.
- The AI label is the host's on every chat, whoever draws the page; a theme's composer sits inside
  `cards.AiLabelFence` ([pitfalls.md](pitfalls.md)).
- What a theme's own chat takes on, each of which the Studio chat does:
  - **The conversation on screen**: `useChatController()` with no argument in the page, then
    `useChatController(conversation)` in a child keyed by `conversation.key`; `null` while it opens.
  - **The message box**: the theme's own field, Send and Stop (the SDK has none), inside `cards.AiLabelFence`, sending
    with the controller's `send`; Try again with its `retry`.
  - **The voice button** (`VoiceButton`) beside the box, outside the fence. A voice session's words arrive as two
    ordinary messages (`voice-live-user`, `voice-live-assistant`) at the end of the conversation: draw them as any
    message, and never `useVoice().heard` and `.reply` as well.
  - **Every reply part**: its words through `cards.MarkdownView` with `skipHtml`; its tool lines and receipts
    (`receiptLine`, `receiptLink`); its Deliverables (each linked to `/deliverables?deliverable=<id>`); its approvals
    (`ToolApproval`, `MissionApproval`), withdraw offer and tickets; its failure with Try again; and, after the
    conversation, the approvals whose reply left it (`looseApprovals`) and a Mission suggestion or the Mission made.
  - **The banners**: `TrialExhaustedBanner` while credits are used up, and `FirstRunNudge`.
  - **New chat** (`useStartChat`), and a way back to older conversations (`useConversationList`, or the host's search).
  - **The board's live updates**: `useBoardEventStream(true)` while the page is mounted, so a reply that lands after
    its turn shows.
- A link carrying `?repo=`, `?runtime=` or `?mode=` draws the host's own chat instead (Pages, above).

## `/deliverables`: Deliverables

- Core files: `app/deliverables/page.tsx`, `components/deliverables/studio/deliverables-studio.tsx`.
- SDK: the `deliverables` area (`useDeliverables`, `useDeliverable`, the file and download helpers, the tabs and
  their labels) and `cards.FilePreview`, `cards.MarkdownView`, `cards.MadeBy`.
- Slots: Studio base, `empty-state.mascot@1` on the Templates tab when there are no templates. Classic base, the page
  header (and the Blog tab's) and the Templates tab's empty state.
- What a theme's own Deliverables page takes on:
  - **One Deliverable.** `/deliverables?deliverable=<id>` (`DELIVERABLE_PARAM`) is the host's link to one Deliverable
    (a chat's Deliverables link there), and there is no other page for it: the theme's page draws it, with
    `useDeliverable(id, true)` and the host's renderers (`MarkdownView` for text, `useAuthenticatedBlobUrl` for a picture
    or a video, `useFileDownload` and `deliverableDownloadUrl` for the file). Check the id first (letters, digits, `-`
    and `_`, at most 128); show the list for one that isn't.
  - **The host's other sections.** Links carrying `?tab=` (Blogs, Templates, Brand kit, Socials while offered),
    `?post=` or `?artifact_type=` draw the host's own page (Pages, above), and `DELIVERABLE_EXPLORER_HREF` is the file
    explorer: link to them (`visibleDeliverableTabs`, `DELIVERABLE_TAB_LABELS`), or they are out of reach under the
    theme.
  - **The list**: `useDeliverables(filters)` a page at a time, `DELIVERABLE_FEED_FILTERS` leaving out heartbeats, and
    `fetchNextPage` for more. A list page that answers `success: false` is the query's error, not an empty list.

## `/assignments`: Missions and Playbooks

- Core file: `app/assignments/page.tsx`.
- SDK: the `pages/assignments` area (`useMissions`, `useMission`, the Mission actions, `useRecommendedAssignments`)
  and, for the Playbooks tab, `pages/playbooks`.
- Slots: none under Studio. Classic base, the page header, and the Playbooks tab's empty state when it is empty.

## `/missions/[id]`: One Mission

- Core file: `app/missions/[id]/page.tsx`.
- SDK: `pages/assignments` (`useMission`, `useMissionField`, `useFieldQuery`, the actions: approve, reject, pause,
  resume, cancel, replan, rerun, save as routine, settings).
- Slots: the page header under both bases.

## `/agents`: Agents

- Core files: `app/agents/page.tsx`, `components/agents/studio/agent-management-studio.tsx`.
- SDK: `pages/agents` (`useAgents`, `useAgentStats`).
- Slots: none under Studio. Classic base, the page header.

## `/documents`: Knowledge

- Core files: `app/documents/page.tsx`, `components/documents/document-management.tsx`.
- SDK: `pages/documents` (`useDocuments`, `useDocumentStats`, upload, delete, teams, cloud connections and their
  sync, the database sources).
- Slots: the page header under both bases.

## `/playbooks`: Playbooks

- Core files: `app/playbooks/page.tsx`, `components/playbooks/PlaybooksPanel.tsx`.
- SDK: `pages/playbooks` (`useWorkflowPlaybooks`, `useWorkflowPlaybook`, `usePlaybookExecutions`, create, update,
  delete, run).
- Slots: none under Studio, where the route sends you to `/assignments?tab=playbooks`. Classic base, the page header.

## `/command-center`: The Command Center

- Core files: `app/command-center/page.tsx`, `components/command-center/command-center-shell.tsx`.
- SDK: `pages/command-center` (`useActivityFeed`, `useActivityStats`, `useActivitySchedule`, `useQuestions`,
  `useNeedsYou`, `useWatches`, `useBoardEventStream`) and `events.useHostEvent('board-changed')`.
- Slots: none under Studio. Classic base, the page header.

## `/`: Home

- Core file: `app/page.tsx`.
- Under both bases home sends you to `/chat`, so no slot draws there. A theme that wants its own home registers this
  page.

## Every other page

Every other route is the host's own page, drawn on the theme's `base` inside the theme's frame; the Studio tokens the
theme's look paints ([looks.md](looks.md)) recolour it. A page that draws
core's shared header or empty state carries the placement slots ([mascot-placement.md](mascot-placement.md)); the
host-owned routes ([contract.md](contract.md)) can never be replaced.
