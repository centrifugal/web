import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { SnapshotDetail } from './SnapshotDetail'

// SnapshotDetail seeded its `snapshot` state from the `snapshot` prop via
// useState(initialSnapshot) with no effect to resync it. Navigating from one
// snapshot's detail page straight to another's (e.g. creating a connections
// snapshot from a channel row, which navigates to /snapshots/<new-id> without
// unmounting this component) left the view — and the polling loop's
// snapshot_id — stuck on the previous snapshot.
describe('SnapshotDetail', () => {
  test('updates when navigated to a different snapshot without remounting', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    )

    const completed = {
      snapshot_id: 'snap-a',
      kind: 'channels',
      status: 'completed',
      filter: { channels: { pattern: '*' } },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rows_inserted: 10,
      nodes_expected: 3,
      nodes_reported: 3,
      requested_by: 'alice',
    }
    const running = {
      ...completed,
      snapshot_id: 'snap-b',
      kind: 'connections',
      status: 'running',
      filter: { connections: {} },
      requested_by: 'bob',
    }

    const { rerender } = render(
      <MemoryRouter>
        <SnapshotDetail
          snapshot={completed}
          authorization=""
          signinSilent={() => {}}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Completed')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <SnapshotDetail
          snapshot={running}
          authorization=""
          signinSilent={() => {}}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
  })
})
