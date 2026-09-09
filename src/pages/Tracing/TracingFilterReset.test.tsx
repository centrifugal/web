import { render, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { ShellContext } from 'contexts/ShellContext'

import { Tracing } from './Tracing'

// Switching trace type clears the filter input. The validity flag behind the error
// styling — and behind the guard in the submit handler — has to be cleared with it,
// otherwise an invalid expression typed on one tab keeps blocking Start on the next
// one even though the filter field is visibly empty.
describe('Tracing filter validity', () => {
  test('clears the invalid-filter flag when the trace type changes', async () => {
    const showAlert = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: () => new Promise(() => {}) }) },
    })
    vi.stubGlobal('fetch', fetchMock)

    const { container, getByText, getByRole } = render(
      <ShellContext.Provider
        value={{
          numberOfPeers: 1,
          tabHasFocus: true,
          setNumberOfPeers: () => {},
          setTitle: () => {},
          showAlert,
        }}
      >
        <MemoryRouter>
          <Tracing signinSilent={() => {}} authorization="" />
        </MemoryRouter>
      </ShellContext.Provider>
    )

    const input = (name: string) =>
      container.querySelector(`input[name="${name}"]`) as HTMLInputElement

    // cel-js is imported dynamically, and the component only flags a filter as
    // invalid once that import has landed. Yield to the macrotask queue so the
    // import resolves before typing — polling for it inside waitFor() would not
    // work here, because a waitFor() callback that mutates the DOM re-triggers
    // itself through waitFor's MutationObserver in an unbounded microtask loop
    // that starves the very import it is waiting on.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // The entity field is required, so it must be filled for submit to fire.
    fireEvent.change(input('channel'), { target: { value: 'test' } })
    fireEvent.change(input('filter'), { target: { value: 'event.type ==' } })

    fireEvent.click(getByText('Start'))
    expect(showAlert).toHaveBeenLastCalledWith(
      'Invalid filter expression',
      expect.objectContaining({ severity: 'error' })
    )
    expect(fetchMock).not.toHaveBeenCalled()

    // Switching trace type clears the filter, so Start must work again.
    fireEvent.click(getByRole('tab', { name: 'User' }))
    expect(input('filter').value).toBe('')

    showAlert.mockClear()
    fireEvent.change(input('user'), { target: { value: 'alice' } })
    fireEvent.click(getByText('Start'))

    expect(showAlert).not.toHaveBeenCalled()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })
})
