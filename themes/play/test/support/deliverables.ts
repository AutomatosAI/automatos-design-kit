// The shelf's Deliverables, moved with core's components/play/deliverables/__tests__/play-shelf.test.tsx
// (its rows, pages and dates; fake data only), and react-query's answer as the SDK's useDeliverables hands
// it, set on the harness's fake host (host.setDeliverables).
import type { Deliverable, DeliverableListResponse } from '@automatos/theme-sdk'
import { act } from '@testing-library/react'
import { vi } from 'vitest'
import { host } from '@automatos/theme-harness/host'

/** The host's page of the list (hooks/use-deliverables-api.ts PAGE_SIZE). */
export const PAGE_SIZE = 24
/** October, as Date counts months. */
const OCTOBER = 9
const YEAR = 2026

/** A local time on that day of October 2026. */
export function at(day: number, hour = 9): string {
  return new Date(YEAR, OCTOBER, day, hour).toISOString()
}

export function row(id: string, fields: Partial<Deliverable> = {}): Deliverable {
  return {
    id,
    workspace_id: 'workspace-1',
    source_type: 'chat',
    source_id: null,
    agent_id: null,
    agent_name: null,
    artifact_type: 'document',
    title: `Deliverable ${id}`,
    summary: null,
    storage_type: 'workspace',
    file_path: `outputs/${id}.md`,
    file_name: null,
    file_type: null,
    file_size_bytes: null,
    preview_url: null,
    preview_type: null,
    thumbnail_url: null,
    extra: {},
    status: 'active',
    created_at: '2026-10-01T09:00:00+00:00',
    updated_at: '2026-10-01T09:00:00+00:00',
    ...fields,
  }
}

/** Four Deliverables, newest first: today, yesterday, Monday and the 4th. */
export const ROWS: readonly Deliverable[] = [
  row('d-laptop', { title: 'Laptop shortlist', artifact_type: 'report', created_at: at(14), thumbnail_url: '/api/deliverables/d-laptop/thumbnail' }),
  row('d-chem', { title: 'Chemistry revision plan', artifact_type: 'document', created_at: at(13) }),
  row('d-poster', { title: 'Bake sale poster', artifact_type: 'image', created_at: at(12), preview_url: '/api/workspaces/files/poster.png' }),
  row('d-slides', { title: 'Climate debate slides', artifact_type: 'slide', created_at: at(4) }),
]

/** `count` Deliverables made today, d-0 to d-<count - 1>, each titled by its number. */
export function numbered(count: number): readonly Deliverable[] {
  return Array.from({ length: count }, (_, index) => row(`d-${index}`, { title: `Deliverable number ${index}`, created_at: at(14) }))
}

export function page(rows: readonly Deliverable[], total = rows.length, offset = 0): DeliverableListResponse {
  return { success: true, deliverables: [...rows], total, limit: PAGE_SIZE, offset }
}

/** What fetchNextPage's promise gives the shelf: react-query's result, read for isError only. */
interface PageResult {
  readonly isError: boolean
  readonly error: unknown
}

export interface Answer {
  readonly data?: { readonly pages: readonly DeliverableListResponse[] }
  readonly isError?: boolean
  readonly error?: unknown
  readonly hasNextPage?: boolean
  readonly isFetchingNextPage?: boolean
}

const PAGE_LOADED: PageResult = Object.freeze({ isError: false, error: null })

/**
 * react-query's result for the shelf from now on, kept as one object as react-query keeps its data between
 * renders, and set inside act so a shelf on screen renders it. Its fetchNextPage and refetch are mocks.
 */
export function answer({ data, isError = false, error = null, hasNextPage = false, isFetchingNextPage = false }: Answer) {
  const result = {
    data: data === undefined ? undefined : { pages: data.pages, pageParams: data.pages.map((loaded) => loaded.offset) },
    isLoading: data === undefined && !isError,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: vi.fn(async (): Promise<PageResult> => PAGE_LOADED),
    refetch: vi.fn(async (): Promise<unknown> => ({})),
  }
  act(() => {
    host.setDeliverables(result)
  })
  return result
}
