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
  previously_approved: false,
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
    new_total: 120,
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

// A retrain opens on what earlier reviews decided: allowed values ticked,
// denied ones denied and not tickable, so only what is new needs reading. And
// the review saves all three answers, not only the ticks.
describe('ReviewScreen decisions', () => {
  const rows: CandidateValue[] = [
    {
      ...row(0),
      path: 'market.status',
      value: 'open',
      value_hash: 'h-open',
      previously_approved: true,
    },
    {
      ...row(1),
      path: 'market.status',
      value: 'halted',
      value_hash: 'h-halted',
      previously_denied: true,
    },
    { ...row(2), path: 'user.email', value: 'a@b.c', value_hash: 'h-email' },
    {
      ...row(3),
      path: 'market.venue',
      value: 'XNAS',
      value_hash: 'h-venue',
      recommended: true,
    },
  ]
  const retrain: Candidate = {
    ...candidate,
    values_total: rows.length,
    recommended_hashes: ['h-venue'],
    prior_decisions: {
      allowed: ['h-open'],
      denied: ['h-halted'],
      // Not collected any more, so none of its values is in the list.
      denied_fields: ['user.ssn'],
    },
  }
  let api: CompressionApiHook & {
    getCandidateValues: ReturnType<typeof vi.fn>
  }
  const setup = () => {
    const draftCandidate = vi.fn(async () => retrain)
    api = {
      getCandidateValues: vi.fn(async () => ({
        ...pageFor(),
        values: rows,
        total: rows.length,
        new_total: 2,
        next_cursor: '',
      })),
      previewCandidate: vi.fn(async () => {
        throw new Error('not measured in this test')
      }),
      draftCandidate,
      handleError: vi.fn(),
    } as unknown as typeof api
    render(
      <MemoryRouter>
        <ReviewScreen
          api={api}
          candidate={retrain}
          onBack={() => {}}
          onCandidateUpdated={() => {}}
          onApproved={() => {}}
        />
      </MemoryRouter>
    )
    return draftCandidate
  }
  const box = (path: string, value: string) =>
    screen.getByRole('checkbox', { name: `Allow ${path} = ${value}` })

  it('opens on earlier decisions and the recommendation', async () => {
    setup()
    await screen.findByText('open')
    expect(box('market.status', 'open')).toBeChecked()
    expect(box('market.venue', 'XNAS')).toBeChecked()
    expect(box('market.status', 'halted')).not.toBeChecked()
    expect(box('market.status', 'halted')).toBeDisabled()
    expect(box('user.email', 'a@b.c')).not.toBeChecked()
    expect(box('user.email', 'a@b.c')).not.toBeDisabled()
  })

  it('denies a field whole and saves all three answers', async () => {
    const draftCandidate = setup()
    await screen.findByText('a@b.c')
    fireEvent.click(
      screen.getByRole('button', { name: 'Deny user.email = a@b.c' })
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /deny every value of/i })
    )
    expect(box('user.email', 'a@b.c')).toBeDisabled()

    // Undoing a value's denial leaves it not reviewed, not allowed.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Undo denial of market.status = halted',
      })
    )
    expect(box('market.status', 'halted')).not.toBeDisabled()
    expect(box('market.status', 'halted')).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(draftCandidate).toHaveBeenCalled())
    const [, sel] = draftCandidate.mock.calls[0] as unknown as [
      string,
      { approved: string[]; denied: string[]; denied_fields: string[] },
    ]
    expect([...sel.approved].sort()).toEqual(['h-open', 'h-venue'])
    expect(sel.denied).toEqual([])
    expect([...sel.denied_fields].sort()).toEqual(['user.email', 'user.ssn'])
  })

  it('narrows a retrain to the values nobody decided', async () => {
    setup()
    await screen.findByText('open')
    fireEvent.click(screen.getByText('New only (2)'))
    await waitFor(() =>
      expect(api.getCandidateValues).toHaveBeenLastCalledWith(
        'cand-1',
        expect.objectContaining({ new_only: true })
      )
    )
  })

  it('lists a denied field the session never saw, and undoes it', async () => {
    const draftCandidate = setup()
    await screen.findByText('open')
    expect(screen.getByText('user.ssn')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Undo denying user.ssn'))
    expect(screen.queryByText('user.ssn')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(draftCandidate).toHaveBeenCalled())
    const [, sel] = draftCandidate.mock.calls[0] as unknown as [
      string,
      { denied_fields: string[] },
    ]
    expect(sel.denied_fields).toEqual([])
  })
})
