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

  test('renders the server text and a chip per date', async () => {
    const fetchMock = respond(200, {
      sandbox: false,
      text: 'j***@acme.com',
      limits: '3 nodes',
      dates: [
        {
          label: 'Expired',
          at: Date.UTC(2026, 8, 1) / 1000,
          note: 'no updates',
          severity: 'error',
          hint: 'Renew the license to get updates.',
        },
      ],
    })
    render(<LicenseLine authorization="token x" />)
    await screen.findByText('j***@acme.com')
    expect(screen.getByText(/^Expired .* · no updates$/)).toBeTruthy()
    expect(fetchMock.mock.calls[0][0]).toContain('admin/api/license')
  })

  test('renders sandbox mode', async () => {
    respond(200, {
      sandbox: true,
      text: 'Sandbox mode (20 connections, 2 nodes, 5 API rps)',
      limits: '20 connections, 2 nodes, 5 API rps',
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
