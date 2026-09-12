import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { Trends } from './Trends'

// The chart and leaderboard pull in echarts, which isn't relevant here and doesn't
// render usefully under jsdom's canvas-less environment.
vi.mock('./TimeSeriesChart', () => ({ TimeSeriesChart: () => null }))
vi.mock('./LeaderboardTable', () => ({ LeaderboardTable: () => null }))

const catalog = {
  result: {
    trends: [
      {
        id: 'client_connections',
        title: 'Active connections',
        description: '',
        unit: 'connections',
        category: 'Connections',
        chartType: 'line',
        stacked: false,
      },
    ],
  },
}

const trend = (granularitySeconds: number) => ({
  result: {
    metric: 'client_connections',
    unit: 'connections',
    chartType: 'line',
    stacked: false,
    granularitySeconds,
    buckets: [],
    series: [],
  },
})

// fetchData had no guard against out-of-order responses, so a slow query for a
// previous selection (e.g. the 1h range) could resolve after the query for the
// newer selection (24h) and overwrite the chart with data for the wrong range.
describe('Trends', () => {
  test('a slow, stale response does not overwrite a newer selection', async () => {
    let resolveOneHour: (v: unknown) => void = () => {}
    const oneHourPromise = new Promise(resolve => {
      resolveOneHour = resolve
    })

    // Node's own experimental global `localStorage` shadows jsdom's window.localStorage
    // in this environment; stub it so the component's synchronous reads/writes don't throw.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const body = JSON.parse((init?.body as string) || '{}')
        if (body.catalog) {
          return Promise.resolve({ ok: true, json: async () => catalog })
        }
        if (body.to - body.from === 60 * 60) {
          return oneHourPromise.then(() => ({
            ok: true,
            json: async () => trend(10),
          }))
        }
        return Promise.resolve({ ok: true, json: async () => trend(300) })
      })
    )

    render(
      <MemoryRouter>
        <Trends authorization="" signinSilent={() => {}} />
      </MemoryRouter>
    )

    // The default 1h range query is now in flight; switch to 24h before it lands.
    fireEvent.click(await screen.findByRole('button', { name: '24h' }))

    await waitFor(() =>
      expect(screen.getByText(/300s buckets/)).toBeInTheDocument()
    )

    await act(async () => {
      resolveOneHour(undefined)
      // Flush the chained .then() hops (response -> json -> setData) plus
      // React's state-update microtask.
      for (let i = 0; i < 5; i++) await Promise.resolve()
    })

    expect(screen.getByText(/300s buckets/)).toBeInTheDocument()
    expect(screen.queryByText(/10s buckets/)).not.toBeInTheDocument()
  })
})
