import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ReviewScreen } from './ReviewScreen'
import {
  Candidate,
  CandidateValuesResponse,
  CompressionApiHook,
  GetCandidateValuesParams,
  CandidateValue,
} from '../api'

// The values list is paged, and paging is the one part of this screen with
// state that outlives a render. It broke once in a way nothing static could
// catch: the current cursor lived in a ref that was read inside a setState
// updater, which React runs after the ref has already been reassigned, so
// every Next pushed the page it had just landed on. Previous then re-fetched
// the page you were already looking at and the screen appeared frozen.
//
// So this asserts the cursors actually sent, not that a button is enabled.

const PAGE = 50

const row = (i: number): CandidateValue => ({
  path: `$.field${i}`,
  value: `value-${i}`,
  value_hash: `hash-${i}`,
  occurrences: 100 - i,
  witnesses: 10,
  contribution: 1000 - i,
  decided: null,
  recommended: false,
  previously_denied: false,
})

const candidate: Candidate = {
  id: 'cand-1',
  fidelity: 'reviewed',
  ratio_by_protocol: { json: 4.5 },
  size_curve: [],
  values_total: 120,
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  created_at: new Date().toISOString(),
  draft_count: 0,
  recommended_count: 0,
  recommended_ratio: 0,
  recommended_size: 0,
}

// Three pages of 50, 50 and 20, cursors as the server sends them: an offset.
const pageFor = (cursor?: string): CandidateValuesResponse => {
  const start = cursor ? Number(cursor) : 0
  const values = Array.from({ length: Math.min(PAGE, 120 - start) }, (_, i) =>
    row(start + i)
  )
  const end = start + values.length
  return {
    values,
    total: 120,
    total_contribution: 100000,
    next_cursor: end < 120 ? String(end) : '',
    denied_summary: {
      name: 0,
      shape: 0,
      channel_name: 0,
      length: 0,
      prior_decision: 0,
    },
  }
}

describe('ReviewScreen paging', () => {
  it('Previous returns to the page before, not the current one', async () => {
    const cursorsRequested: (string | undefined)[] = []
    const getCandidateValues = vi.fn(
      async (_id: string, params?: GetCandidateValuesParams) => {
        cursorsRequested.push(params?.cursor)
        return pageFor(params?.cursor)
      }
    )

    const api = {
      getCandidateValues,
      // The screen measures the current selection as it changes; the paging
      // assertions do not depend on it, but leaving it out would have the
      // component call undefined.
      previewCandidate: vi.fn(async () => {
        throw new Error('not measured in this test')
      }),
      handleError: vi.fn(),
    } as unknown as CompressionApiHook

    render(
      <MemoryRouter>
        <ReviewScreen
          api={api}
          candidate={candidate}
          onBack={() => {}}
          onCandidateUpdated={() => {}}
          onApproved={() => {}}
        />
      </MemoryRouter>
    )

    await screen.findByText('value-0')

    const next = screen.getByRole('button', { name: /next/i })
    const prev = screen.getByRole('button', { name: /previous/i })

    // On the first page there is nowhere back to go.
    expect(prev).toBeDisabled()

    fireEvent.click(next)
    await screen.findByText('value-50')
    fireEvent.click(next)
    await screen.findByText('value-100')

    fireEvent.click(prev)
    await screen.findByText('value-50')
    fireEvent.click(prev)
    await screen.findByText('value-0')

    await waitFor(() => expect(prev).toBeDisabled())

    // first, next, next, prev, prev — the last two must walk back down, not
    // repeat where they already were.
    expect(cursorsRequested).toEqual([undefined, '50', '100', '50', undefined])
  })
})
