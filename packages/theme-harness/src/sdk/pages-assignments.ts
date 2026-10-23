/**
 * PRD-261 B-02b: the fake of SDK area `pages/assignments`. It mirrors core's
 * frontend/lib/theme-sdk/pages/assignments.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac) in the page areas'
 * frozen views (src/internal/page-views.ts), with core's mission id rule (:129): a read given a null id asks
 * for nothing, a read given a malformed one asks for nothing and says so in `error`, and an action given one
 * throws a TypeError (runAsync rejects) before anything is sent. Reads answer what a test set
 * (host.setPageQuery), runs what it set (host.setPageAction), each kept with the theme's arguments.
 */
import type {
  Mission, MissionApproveInput, MissionCreateBody, MissionDetail, MissionField, MissionFieldOptions, MissionFieldQueryInput,
  MissionFieldTrace, MissionFilters, MissionList, MissionRejectInput, MissionReplanInput, MissionSettings, MissionSettingsInput,
  RecommendedAssignments, SavedRoutine, SaveAsRoutineInput,
} from '@automatos/theme-sdk'
import { useCallback } from 'react'
import { refuse } from '../internal/cell.ts'
import { usePageAction, usePageQuery } from '../internal/page-views.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** assignments.ts:129-130. */
const MISSION_ID = /^[A-Za-z0-9_-]{1,128}$/
const NOT_A_MISSION_ID = 'Not a mission id.'

const isMissionId = (value: unknown): value is string => typeof value === 'string' && MISSION_ID.test(value)
const isNone = (value: unknown): boolean => value === null || value === undefined
/** assignments.ts:159: a malformed id's refusal, or null. */
const refusalOf = (missionId: unknown): string | null => (isNone(missionId) || isMissionId(missionId) ? null : NOT_A_MISSION_ID)

/** assignments.ts:165. */
function checkedInputId<V extends { readonly id: string }>(variables: V): V {
  return isMissionId(variables?.id) ? variables : refuse(NOT_A_MISSION_ID)
}

/** assignments.ts:170. */
function checkedIdArgument(id: string): string {
  return isMissionId(id) ? id : refuse(NOT_A_MISSION_ID)
}

/** assignments.ts:179. */
export const useMissions = ((filters?: MissionFilters) => usePageQuery<MissionList>('useMissions', [filters])) satisfies Sdk['useMissions']

/** assignments.ts:184: a null id asks for nothing. */
export const useMission = ((missionId: string | null) =>
  usePageQuery<MissionDetail>('useMission', [missionId], refusalOf(missionId), isNone(missionId))) satisfies Sdk['useMission']

/** assignments.ts:190. */
export const useMissionField = ((missionId: string | null, options?: MissionFieldOptions) =>
  usePageQuery<MissionField>('useMissionField', [missionId, options], refusalOf(missionId), isNone(missionId) || options?.enabled === false)) satisfies Sdk['useMissionField']

/** assignments.ts:197: a null or malformed id refuses every run. */
export const useFieldQuery = ((missionId: string | null) => {
  const prepare = useCallback(
    (variables: MissionFieldQueryInput) => (isMissionId(missionId) ? variables : refuse(NOT_A_MISSION_ID)),
    [missionId],
  )
  return usePageAction<MissionFieldQueryInput, MissionFieldTrace>('useFieldQuery', prepare)
}) satisfies Sdk['useFieldQuery']

/** assignments.ts:207. */
export const useRecommendedAssignments = ((limit?: number) =>
  usePageQuery<RecommendedAssignments>('useRecommendedAssignments', [limit])) satisfies Sdk['useRecommendedAssignments']

/** assignments.ts:214. */
export const useApproveMission = (() => usePageAction<MissionApproveInput, Mission>('useApproveMission', checkedInputId)) satisfies Sdk['useApproveMission']

/** assignments.ts:219. */
export const useRejectMission = (() => usePageAction<MissionRejectInput, Mission>('useRejectMission', checkedInputId)) satisfies Sdk['useRejectMission']

/** assignments.ts:224. */
export const usePauseMission = (() => usePageAction<string, Mission>('usePauseMission', checkedIdArgument)) satisfies Sdk['usePauseMission']

/** assignments.ts:229. */
export const useResumeMission = (() => usePageAction<string, Mission>('useResumeMission', checkedIdArgument)) satisfies Sdk['useResumeMission']

/** assignments.ts:234. */
export const useCancelMission = (() => usePageAction<string, Mission>('useCancelMission', checkedIdArgument)) satisfies Sdk['useCancelMission']

/** assignments.ts:239. */
export const useReplanMission = (() => usePageAction<MissionReplanInput, Mission>('useReplanMission', checkedInputId)) satisfies Sdk['useReplanMission']

/** assignments.ts:244: unchecked, as core's. */
export const useRerunMission = (() => usePageAction<MissionCreateBody, Mission>('useRerunMission')) satisfies Sdk['useRerunMission']

/** assignments.ts:249. */
export const useSaveAsRoutine = (() => usePageAction<SaveAsRoutineInput, SavedRoutine>('useSaveAsRoutine', checkedInputId)) satisfies Sdk['useSaveAsRoutine']

/** assignments.ts:254. */
export const useUpdateMissionSettings = (() =>
  usePageAction<MissionSettingsInput, MissionSettings>('useUpdateMissionSettings', checkedInputId)) satisfies Sdk['useUpdateMissionSettings']
