/**
 * PRD-261 B-02b: the fake of SDK area `pages/documents`. It mirrors core's
 * frontend/lib/theme-sdk/pages/documents.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac) in the page areas'
 * frozen views (src/internal/page-views.ts), with core's input checks (:224, :250-268, internal/documents-view.ts
 * :68-81): a refused `run` throws a TypeError, a refused `runAsync` or database call rejects with one, and
 * nothing is sent. Reads answer what a test set (host.setPageQuery); useDatabaseKnowledge's sources and
 * templates are what host.setDatabaseKnowledge set, and each of its calls is kept as a run
 * ('useDatabaseKnowledge.<call>') answered by host.setDatabaseCall, or by an empty answer.
 */
import type {
  KnowledgeCacheStats, KnowledgeCloudConnection, KnowledgeDatabase, KnowledgeDatabaseQueryOptions, KnowledgeDatabaseQueryResult,
  KnowledgeDatabaseSource, KnowledgeDatabaseSourceInput, KnowledgeDocument, KnowledgeQueryTemplate, KnowledgeRootFolderInput,
  KnowledgeStats, KnowledgeSyncJob, KnowledgeTeam, KnowledgeTeamCounts, KnowledgeUploadInput,
} from '@automatos/theme-sdk'
import { useMemo } from 'react'
import { cell, refuse } from '../internal/cell.ts'
import { checkedWholeId, databaseCall, frozenCopy, usePageAction, usePageQuery } from '../internal/page-views.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** What useDatabaseKnowledge reads: the sources and templates, why they failed, or still loading. */
export type DatabaseKnowledgeAnswer =
  | { readonly sources: readonly KnowledgeDatabaseSource[]; readonly templates: readonly KnowledgeQueryTemplate[] }
  | { readonly error: string }
  | 'loading'

/** documents.ts:224. */
const DOCUMENT_ID = /^[A-Za-z0-9_-]{1,128}$/
const NO_ARGS: readonly unknown[] = Object.freeze([])
const NONE: readonly never[] = Object.freeze([])
const EMPTY_QUERY_RESULT: KnowledgeDatabaseQueryResult = Object.freeze({ sql: '', results: NONE, validation: null, execution_time: 0 })
const EMPTY_CACHE_STATS: KnowledgeCacheStats = Object.freeze({
  schema_cache_hits: 0, schema_cache_misses: 0, query_cache_hits: 0, query_cache_misses: 0, schema_hit_rate: 0, query_hit_rate: 0,
})

const database = cell<DatabaseKnowledgeAnswer>(Object.freeze({ sources: NONE, templates: NONE }))

/** documents-view.ts:73. */
const checkedText = (value: unknown, what: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : refuse(`${what} must be text.`)

/** documents.ts:250. */
function prepareDocumentId(documentId: string | number): string | number {
  const id = typeof documentId === 'number' ? String(documentId) : documentId
  return typeof id === 'string' && DOCUMENT_ID.test(id) ? documentId : refuse(`${String(documentId)} is not a document id.`)
}

/** documents.ts:255: a File, and a text description when given. */
function prepareUpload(input: KnowledgeUploadInput): KnowledgeUploadInput {
  if (typeof File === 'undefined' || !(input?.file instanceof File)) refuse('an upload needs a File.')
  if (input.description !== undefined && typeof input.description !== 'string') refuse('description must be text.')
  return input
}

const prepareConnectionId = (connectionId: number): number => checkedWholeId(connectionId, 'connection')

/** documents.ts:264. */
const prepareRootFolder = (input: KnowledgeRootFolderInput): KnowledgeRootFolderInput => ({
  connectionId: checkedWholeId(input?.connectionId, 'connection'),
  rootFolderPath: checkedText(input?.rootFolderPath, 'rootFolderPath'),
})

/** documents.ts:272. */
export const useDocuments = ((team?: string | null) =>
  usePageQuery<readonly KnowledgeDocument[]>('useDocuments', [team ?? null])) satisfies Sdk['useDocuments']

/** documents.ts:278. */
export const useDocumentStats = (() => usePageQuery<KnowledgeStats>('useDocumentStats', NO_ARGS)) satisfies Sdk['useDocumentStats']

/** documents.ts:283. */
export const useUploadDocument = (() => usePageAction<KnowledgeUploadInput, unknown>('useUploadDocument', prepareUpload)) satisfies Sdk['useUploadDocument']

/** documents.ts:288. */
export const useDeleteDocument = (() => usePageAction<string | number, unknown>('useDeleteDocument', prepareDocumentId)) satisfies Sdk['useDeleteDocument']

/** documents.ts:293. */
export const useTeams = (() => usePageQuery<readonly KnowledgeTeam[]>('useTeams', NO_ARGS)) satisfies Sdk['useTeams']

/** documents.ts:298. */
export const useDocumentTeamCounts = (() => usePageQuery<KnowledgeTeamCounts>('useDocumentTeamCounts', NO_ARGS)) satisfies Sdk['useDocumentTeamCounts']

/** documents.ts:303. */
export const useCloudConnections = (() =>
  usePageQuery<readonly KnowledgeCloudConnection[]>('useCloudConnections', NO_ARGS)) satisfies Sdk['useCloudConnections']

/** documents.ts:308. */
export const useTriggerSync = (() => usePageAction<number, KnowledgeSyncJob>('useTriggerSync', prepareConnectionId)) satisfies Sdk['useTriggerSync']

/** documents.ts:313. */
export const useSelectRootFolder = (() =>
  usePageAction<KnowledgeRootFolderInput, unknown>('useSelectRootFolder', prepareRootFolder)) satisfies Sdk['useSelectRootFolder']

/** documents.ts:325: the database calls; each checks its input first (a rejection), then is kept and answered. */
const DATABASE_CALLS = Object.freeze({
  refresh: async (): Promise<void> => databaseCall('refresh', null, undefined),
  createSource: async (input: KnowledgeDatabaseSourceInput): Promise<unknown> => {
    const name = checkedText(input?.name, 'name')
    const credentialId = checkedWholeId(input?.credentialId, 'credential')
    return databaseCall('createSource', { ...input, name, credentialId }, null)
  },
  deleteSource: async (sourceId: number): Promise<void> => databaseCall('deleteSource', checkedWholeId(sourceId, 'database source'), undefined),
  syncSchema: async (sourceId: number): Promise<void> => databaseCall('syncSchema', checkedWholeId(sourceId, 'database source'), undefined),
  executeQuery: async (sourceId: number, question: string, options?: KnowledgeDatabaseQueryOptions): Promise<KnowledgeDatabaseQueryResult> => {
    const variables = { sourceId: checkedWholeId(sourceId, 'database source'), question: checkedText(question, 'question'), options }
    return databaseCall('executeQuery', variables, EMPTY_QUERY_RESULT)
  },
  getSchemaMetadata: async (sourceId: number): Promise<unknown> =>
    databaseCall('getSchemaMetadata', checkedWholeId(sourceId, 'database source'), null),
  getCacheStats: async (): Promise<KnowledgeCacheStats> => databaseCall('getCacheStats', null, EMPTY_CACHE_STATS),
})

/** documents.ts:351: the sources and templates a test set, and the page's calls on them. */
export const useDatabaseKnowledge = ((): KnowledgeDatabase => {
  const answer = database.use()
  return useMemo(() => {
    const listed = typeof answer === 'object' && 'sources' in answer ? answer : null
    return Object.freeze({
      ...DATABASE_CALLS,
      sources: frozenCopy(listed?.sources ?? NONE),
      templates: frozenCopy(listed?.templates ?? NONE),
      isLoading: answer === 'loading',
      error: typeof answer === 'object' && 'error' in answer ? answer.error : null,
    })
  }, [answer])
}) satisfies Sdk['useDatabaseKnowledge']

/** The controls of this area, gathered by host.ts. */
export const documentsControls = Object.freeze({
  /** What useDatabaseKnowledge reads from now on (by default: no sources and no templates). */
  setDatabaseKnowledge(next: DatabaseKnowledgeAnswer): void {
    database.set(next)
  },
})

export function resetDocuments(): void {
  database.set(Object.freeze({ sources: NONE, templates: NONE }))
}
