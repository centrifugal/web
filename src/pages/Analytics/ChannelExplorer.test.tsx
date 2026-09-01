import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { ChannelExplorer } from './ChannelExplorer'

// TrendPanel pulls in the echarts bundle via a dynamic import, which isn't relevant
// to this test and doesn't render usefully under jsdom's canvas-less environment.
vi.mock('./TrendPanel', () => ({ TrendPanel: () => null }))

const channelData = (channel: string, subscribers: number) => ({
  result: {
    channel,
    found: true,
    namespace: '',
    summary: {
      subscribers,
      publications: 0,
      publishers: 0,
      bytes: 0,
      errors: 0,
    },
    topPublishers: [],
    topSubscribers: [],
    events: [],
  },
})

// Same cancellation-guard bug as UserExplorer: an in-flight request for a
// previously-committed channel could resolve after a newer request and
// overwrite the screen with stale data for the wrong channel.
describe('ChannelExplorer', () => {
  test('a slow, stale response does not overwrite a newer lookup', async () => {
    let resolveOld: (v: unknown) => void = () => {}
    const oldPromise = new Promise(resolve => {
      resolveOld = resolve
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
        if (body.channel === 'chan-a') {
          return oldPromise.then(() => ({
            ok: true,
            json: async () => channelData('chan-a', 111),
          }))
        }
        return Promise.resolve({
          ok: true,
          json: async () => channelData('chan-b', 222),
        })
      })
    )

    render(
      <MemoryRouter>
        <ChannelExplorer authorization="" signinSilent={() => {}} />
      </MemoryRouter>
    )

    const input = screen.getByLabelText('Channel')

    fireEvent.change(input, { target: { value: 'chan-a' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    fireEvent.change(input, { target: { value: 'chan-b' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('222')).toBeInTheDocument())

    await act(async () => {
      resolveOld(undefined)
      // Flush the chained .then() hops (response -> json -> setData) plus
      // React's state-update microtask.
      for (let i = 0; i < 5; i++) await Promise.resolve()
    })

    expect(screen.getByText('222')).toBeInTheDocument()
    expect(screen.queryByText('111')).not.toBeInTheDocument()
  })
})
