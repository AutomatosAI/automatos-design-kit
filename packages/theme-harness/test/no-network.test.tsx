// PRD-261 B-02b (plan §2.2.9): inside the harness the global fetch and XMLHttpRequest throw (src/no-network.ts),
// and the fake SDK works without them: every hook and function of the areas the harness fakes here answers
// with nothing refused. B-02c's chat, deliverables and cards fakes hold the same rule in their own tests.
import * as sdk from '@automatos/theme-sdk'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'

const LOOK = Object.freeze({ schema: 'example-look/v1', id: 'calm', name: 'Calm', sub: 'Soft and quiet' })
const MISSION = 'mission-1'
const PLAYBOOK = 'playbook-1'

beforeEach(() => {
  host.reset()
})

describe('the network, inside the harness', () => {
  it('refuses fetch, naming what it was asked for, and keeps the call', () => {
    expect(() => fetch('/api/workspaces/current')).toThrow(TypeError)
    expect(() => globalThis.fetch(new URL('https://example.com/data'))).toThrow(/refused/)
    expect(host.networkCalls()).toEqual([
      { api: 'fetch', target: '/api/workspaces/current' },
      { api: 'fetch', target: 'https://example.com/data' },
    ])
  })

  it('refuses XMLHttpRequest, and the reset forgets the calls', () => {
    expect(() => new XMLHttpRequest()).toThrow(TypeError)
    expect(host.networkCalls()).toEqual([{ api: 'XMLHttpRequest', target: '(no URL yet)' }])
    host.reset()
    expect(host.networkCalls()).toEqual([])
  })
})

/** Every hook of the faked areas, called as a theme's page calls them. */
function EveryHook() {
  const context = [sdk.useWorkspace(), sdk.useRole(), sdk.useEdition(), sdk.useTrial(), sdk.useHealth(), sdk.useOnline(),
    sdk.useMediaPreferences(), sdk.useTone(), sdk.useThemeLayout()]
  const navigation = [sdk.useHostRouter(), sdk.useHostPathname(), sdk.useHostSearchParams(), sdk.useCoreNav()]
  sdk.useHostEvent('board-changed', () => undefined)
  const looks = [sdk.useLook(), sdk.useLookScope(), sdk.useThemeState('probe')]
  const pages = [sdk.useAgents(), sdk.useAgentStats(), sdk.useMissions(), sdk.useMission(MISSION), sdk.useMissionField(MISSION),
    sdk.useRecommendedAssignments(), sdk.useActivityFeed(), sdk.useActivityStats(), sdk.useActivitySchedule(), sdk.useQuestions(),
    sdk.useNeedsYou(), sdk.useWatches(), sdk.useDocuments(), sdk.useDocumentStats(), sdk.useTeams(), sdk.useDocumentTeamCounts(),
    sdk.useCloudConnections(), sdk.useWorkflowPlaybooks(), sdk.useWorkflowPlaybook(PLAYBOOK), sdk.usePlaybookExecutions(PLAYBOOK)]
  const actions = [sdk.useFieldQuery(MISSION), sdk.useApproveMission(), sdk.useRejectMission(), sdk.usePauseMission(),
    sdk.useResumeMission(), sdk.useCancelMission(), sdk.useReplanMission(), sdk.useRerunMission(), sdk.useSaveAsRoutine(),
    sdk.useUpdateMissionSettings(), sdk.useUploadDocument(), sdk.useDeleteDocument(), sdk.useTriggerSync(), sdk.useSelectRootFolder(),
    sdk.useCreatePlaybook(), sdk.useUpdatePlaybook(), sdk.useDeletePlaybook(), sdk.useExecutePlaybook(), sdk.useDatabaseKnowledge()]
  sdk.useBoardEventStream()
  const answered = [...context, ...navigation, ...looks, ...pages, ...actions].filter((value) => value !== undefined)
  return (
    <output>
      {answered.length}
      <sdk.HostLink href="/chat">Chat</sdk.HostLink>
    </output>
  )
}

describe('the fake SDK, with the network refused', () => {
  it('renders every hook of the faked areas, and nothing reaches the network', () => {
    act(() => host.setLooks({ look: LOOK }))
    render(<EveryHook />)
    expect(screen.getByRole('status')).toHaveTextContent(/\d+/)
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat')
    expect(host.boardStreams()).toBe(1)
    expect(host.pageAsks().length).toBeGreaterThan(0)
    expect(host.networkCalls()).toEqual([])
  })

  it('answers every plain function of the faked areas, and nothing reaches the network', () => {
    host.setFilesRoot('/files/')
    host.setLooks({ look: LOOK })
    const answers = [
      sdk.SDK_VERSION, sdk.defineTheme({ register: () => undefined }), sdk.ticketHref(7), sdk.chatHref('c-1'), sdk.missionHref(MISSION),
      sdk.questionHref({ id: 1, subject_type: 'board_task', subject_id: '7' }), sdk.resolveActiveNavId('/chat'),
      sdk.notify({ title: 'Saved' }), sdk.HOST_EVENT_NAMES, sdk.onHostEvent('chat-changed', () => undefined),
      sdk.saveLook(LOOK), sdk.listLooks(), sdk.exportLook(LOOK), sdk.importLook(JSON.stringify(LOOK)), sdk.assetUrl('assets/a.png'),
      sdk.readThemeState('probe'), sdk.writeThemeState('probe', true), sdk.removeThemeState('probe'),
      sdk.subscribeThemeState('probe', () => undefined), sdk.THEME_STATE_LIMITS,
    ]
    sdk.dismissNotice()
    sdk.openGlobalSearch()
    expect(answers.filter((answer) => answer === undefined)).toEqual([])
    expect(sdk.assetUrl('assets/a.png')).toBe('/files/assets/a.png')
    expect(host.globalSearchOpens()).toBe(1)
    expect(host.networkCalls()).toEqual([])
  })
})
