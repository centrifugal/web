import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, afterEach } from 'vitest'

import { LicenseLine } from './LicenseLine'

const respond = (status: number, body?: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), { status })
    )

describe('LicenseLine', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows the owner as sent by the server and a date chip', async () => {
    const now = Math.floor(Date.now() / 1000)
    const fetchMock = respond(200, {
      sandbox: false,
      owner: 'j***@acme.com',
      no_updates_at: now + 10 * 24 * 3600,
      server_time: now,
    })
    render(<LicenseLine authorization="token x" />)
    await screen.findByText('j***@acme.com')
    expect(screen.getByText(/^Updates until/)).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toContain('admin/api/license')
  })

  test('shows sandbox mode with its limits', async () => {
    respond(200, {
      sandbox: true,
      max_connections: 20,
      max_nodes: 2,
      max_api_rps: 5,
      server_time: 1,
    })
    render(<LicenseLine authorization="token x" />)
    await screen.findByText('Sandbox mode (20 connections, 2 nodes, 5 API rps)')
  })

  test('renders nothing when the server has no license endpoint', async () => {
    const fetchMock = respond(404)
    const { container } = render(<LicenseLine authorization="token x" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })
})
