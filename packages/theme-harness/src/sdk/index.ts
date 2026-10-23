/**
 * PRD-261 B-02b: the harness's `@automatos/theme-sdk`, the module a theme's tests get for the SDK's name
 * (vitest-preset.ts aliases it here). It mirrors core's frontend/lib/theme-sdk/index.ts:16-31: one module per
 * area, re-exported here. Each area names its SDK names, so an area module's own controls and helpers never
 * reach the surface, and test/surface.test.ts holds the union to the vendored types' value exports, nothing
 * missing and nothing extra. Chat, deliverables and cards are PRD-261 B-02c's fakes over fake fixtures.
 */
export { SDK_VERSION, defineTheme } from './theme.ts'
export {
  useWorkspace, useRole, useEdition, useTrial, useHealth, useOnline, useMediaPreferences, useTone, useThemeLayout,
} from './context.ts'
export {
  BOARD_HREF, QUESTIONS_HREF, CHAT_HREF, DELIVERABLES_HREF, DELIVERABLE_EXPLORER_HREF, DELIVERABLE_PARAM, LOOKS_HREF, LOOK_STYLE_HREF,
  ticketHref, questionHref, missionHref, chatHref, HostLink, useHostRouter, useHostPathname, useHostSearchParams, useCoreNav,
  resolveActiveNavId,
} from './navigation.ts'
export { notify, dismissNotice } from './notices.ts'
export { HOST_EVENT_NAMES, onHostEvent, useHostEvent, openGlobalSearch } from './events.ts'
export {
  useChatController, useConversationList, useRecentChats, useStartChat, receiptLine, receiptLink, movedSomethingOnTheBoard, liveReceiptsOf,
} from './chat.ts'
export {
  DELIVERABLE_FEED_FILTERS, DELIVERABLE_TAB_LABELS, useDeliverables, useDeliverable, useFileDownload, useAuthenticatedBlobUrl,
  deliverableFileUrl, deliverableDownloadUrl, fileDownloadUrl, deliverableFilename, visibleDeliverableTabs, deliverableLabel,
} from './deliverables.ts'
export {
  ToolApproval, MissionApproval, TaskCard, WithdrawOfferCard, MissionSuggestionCard, MissionCreatedCard, FilePreview, MarkdownView,
  MadeBy, TrialExhaustedBanner, FirstRunNudge, HeaderUtilities, AiLabelFence, CorePage,
} from './cards.ts'
export { useLook, saveLook, listLooks, exportLook, importLook, useLookScope } from './looks.ts'
export { assetUrl } from './assets.ts'
export { useAgents, useAgentStats } from './pages-agents.ts'
export {
  useMissions, useMission, useMissionField, useFieldQuery, useRecommendedAssignments, useApproveMission, useRejectMission,
  usePauseMission, useResumeMission, useCancelMission, useReplanMission, useRerunMission, useSaveAsRoutine, useUpdateMissionSettings,
} from './pages-assignments.ts'
export {
  useDocuments, useDocumentStats, useUploadDocument, useDeleteDocument, useTeams, useDocumentTeamCounts, useCloudConnections,
  useTriggerSync, useSelectRootFolder, useDatabaseKnowledge,
} from './pages-documents.ts'
export {
  useWorkflowPlaybooks, useWorkflowPlaybook, usePlaybookExecutions, useCreatePlaybook, useUpdatePlaybook, useDeletePlaybook,
  useExecutePlaybook,
} from './pages-playbooks.ts'
export {
  useActivityFeed, useActivityStats, useActivitySchedule, useQuestions, useNeedsYou, useWatches, useBoardEventStream,
} from './pages-command-center.ts'
export { readThemeState, writeThemeState, removeThemeState, subscribeThemeState, useThemeState, THEME_STATE_LIMITS } from './storage.ts'
