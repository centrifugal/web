import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { SessionDetail } from './SessionDetail'
import { Candidate, CompressionApiHook, Session } from '../api'
import {
  Session as AdminSession,
  SessionContext,
} from 'contexts/SessionContext'

// A collected session with nothing built is built on sight, once, and only
// when the empty list was actually read and the role may build.

const collected: Session = {
  id: 's1',
  status: 'collected',
  training_mode: 'schema',
  filter: {},
  started_at: '2026-10-25T10:00:00Z',
  deadline: '2026-10-25T10:10:00Z',
  stopped_at: null,
  nodes_expected: 1,
  nodes_reported: 1,
  error_message: '',
}

const makeApi = (overrides: Partial<CompressionApiHook> = {}) => {
  const api = {
    getSession: vi.fn().mockResolvedValue(collected),
    listCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
    buildCandidates: vi
      .fn()
      .mockResolvedValue({ candidates: [], reason: 'no traffic matched' }),
    handleError: vi.fn(),
    ...overrides,
  }
  return api as unknown as CompressionApiHook & typeof api
}

const viewer: AdminSession = {
  user: { name: 'v', auth: 'oidc', role: 'viewer', roles: ['viewer'] },
  permissions: ['ops:read'],
}

const renderDetail = (api: CompressionApiHook, session: AdminSession | null) =>
  render(
    <SessionContext.Provider value={session}>
      <MemoryRouter>
        <SessionDetail api={api} sessionId="s1" onBack={() => {}} />
      </MemoryRouter>
    </SessionContext.Provider>
  )

describe('SessionDetail', () => {
  it('builds a collected session with no candidates once, and says why nothing was built', async () => {
    const api = makeApi()
    renderDetail(api, null)
    expect(await screen.findByText('no traffic matched')).toBeInTheDocument()
    expect(api.buildCandidates).toHaveBeenCalledTimes(1)
  })

  it('does not build for a role that may not', async () => {
    const api = makeApi()
    renderDetail(api, viewer)
    await waitFor(() => expect(api.listCandidates).toHaveBeenCalled())
    await screen.findByText('Not built yet')
    expect(api.buildCandidates).not.toHaveBeenCalled()
  })

  it('does not build when the candidates could not be read', async () => {
    const api = makeApi({
      listCandidates: vi.fn().mockRejectedValue(new Error('down')),
    } as Partial<CompressionApiHook>)
    renderDetail(api, null)
    await waitFor(() => expect(api.listCandidates).toHaveBeenCalled())
    await screen.findByText('Not built yet')
    expect(api.buildCandidates).not.toHaveBeenCalled()
  })

  // What to use is the decision on this screen; the size table and older
  // builds are there, folded, for whoever wants them.
  it('shows the current candidates and folds the rest', async () => {
    const cand = (
      id: string,
      fidelity: string,
      over: Partial<Candidate> = {}
    ): Candidate =>
      ({
        id,
        fidelity,
        ratio_by_protocol: { json: 3 },
        size_curve: [
          {
            size_bytes: 4096,
            ratio: 3.2,
            measured: true,
            recommended_values: 10,
            delivery_bytes: 1500,
            shapes_held: 1,
            shapes_total: 1,
            values_held: 10,
            values_total: 10,
          },
        ],
        values_total: fidelity === 'schema' ? 0 : 120,
        expires_at: '2026-10-30T10:00:00Z',
        created_at: '2026-10-25T10:00:00Z',
        draft_count: 0,
        recommended_count: 10,
        recommended_ratio: 3.2,
        recommended_size: 4096,
        ...over,
      }) as Candidate
    const api = makeApi({
      listCandidates: vi.fn().mockResolvedValue({
        candidates: [
          cand('new-v', 'reviewed'),
          cand('s', 'schema'),
          cand('old-v', 'reviewed'),
        ],
      }),
    } as Partial<CompressionApiHook>)
    renderDetail(api, null)
    expect(
      await screen.findByRole('button', { name: 'Review values' })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Review values' })
    ).toHaveLength(1)
    expect(screen.queryByText('Wire')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Sizes' })[0])
    expect(await screen.findByText('Wire')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show 1 older build' }))
    expect(
      screen.getAllByRole('button', { name: 'Review values' })
    ).toHaveLength(2)
  })
})
