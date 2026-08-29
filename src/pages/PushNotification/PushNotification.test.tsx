import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { ShellContext } from 'contexts/ShellContext'

import { PushNotification } from './PushNotification'

// device_list failures used to be swallowed silently: the fetch effect
// checked `data.error` and just returned, with no alert and no call to
// handleError, unlike every other API call in this file (e.g.
// send_push_notification) which surfaces `data.error` via showAlert. An
// operator hitting a permission or backend error here saw nothing at all.
describe('PushNotification', () => {
  test('shows an alert when device_list returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: 'permission denied' } }),
      })
    )
    // Node's own experimental global `localStorage` shadows jsdom's window.localStorage
    // in this environment; stub it so the component's synchronous localStorage.getItem
    // read on mount doesn't throw.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
    })

    const showAlert = vi.fn()

    render(
      <MemoryRouter>
        <ShellContext.Provider
          value={{
            numberOfPeers: 1,
            tabHasFocus: true,
            setNumberOfPeers: () => {},
            setTitle: () => {},
            showAlert,
          }}
        >
          <PushNotification
            signinSilent={() => {}}
            authorization=""
            edition="oss"
          />
        </ShellContext.Provider>
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('Error: permission denied', {
        severity: 'error',
      })
    )
  })
})
