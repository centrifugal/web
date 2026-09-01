import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { UserExplorer } from './UserExplorer'

// TrendPanel pulls in the echarts bundle via a dynamic import, which isn't relevant
// to this test and doesn't render usefully under jsdom's canvas-less environment.
vi.mock('./TrendPanel', () => ({ TrendPanel: () => null }))

const userProfile = (name: string, connections: number) => ({
  result: {
    user: name,
    found: true,
    profile: {
      name,
      version: '',
      transport: '',
      labels: {},
      firstSeen: 0,
      lastSeen: 0,
    },
    summary: {
      connections,
      operations: 0,
      errors: 0,
      disconnects: 0,
      publications: 0,
      channels: 0,
      latencyP95: 0,
      connLatencyP95: 0,
    },
    channels: [],
    events: [],
  },
})

// The fetch effect had no cancellation guard, so an in-flight request for a
// previously-committed user could resolve after a newer request and overwrite
// the screen with stale data for the wrong user (e.g. looking up "alice",
// then quickly looking up "bob" before alice's slower response lands).
describe('UserExplorer', () => {
  test('a slow, stale response does not overwrite a newer lookup', async () => {
    let resolveAlice: (v: unknown) => void = () => {}
    const alicePromise = new Promise(resolve => {
      resolveAlice = resolve
    })

    // Node's own experimental global `localStorage` shadows jsdom's window.localStorage
    // in this environment; stub it so the component's synchronous localStorage reads/writes
    // don't throw.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const body = JSON.parse((init?.body as string) || '{}')
        if (body.user === 'alice') {
          return alicePromise.then(() => ({
            ok: true,
            json: async () => userProfile('alice', 111),
          }))
        }
        return Promise.resolve({
          ok: true,
          json: async () => userProfile('bob', 222),
        })
      })
    )

    render(
      <MemoryRouter>
        <UserExplorer authorization="" signinSilent={() => {}} />
      </MemoryRouter>
    )

    const input = screen.getByLabelText('User ID')

    fireEvent.change(input, { target: { value: 'alice' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    fireEvent.change(input, { target: { value: 'bob' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('222')).toBeInTheDocument())

    await act(async () => {
      resolveAlice(undefined)
      // Flush the chained .then() hops (response -> json -> setData) plus
      // React's state-update microtask.
      for (let i = 0; i < 5; i++) await Promise.resolve()
    })

    expect(screen.getByText('222')).toBeInTheDocument()
    expect(screen.queryByText('111')).not.toBeInTheDocument()
  })
})
