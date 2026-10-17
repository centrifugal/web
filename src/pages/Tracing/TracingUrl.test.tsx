import { render, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, test, expect } from 'vitest'

import { Tracing } from './Tracing'

// The tab lives in the URL: ?tab= when switched by hand, or implied by the
// entity a cross-link passes (Inspector and Snapshots link to
// /tracing?channel=, ?user= and ?client_id=).
let search = ''
const LocationProbe = () => {
  search = useLocation().search
  return null
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/tracing"
          element={
            <>
              <Tracing signinSilent={() => {}} authorization="" />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )

const selectedTab = () =>
  screen
    .getAllByRole('tab')
    .find(t => t.getAttribute('aria-selected') === 'true')?.textContent

const input = (container: HTMLElement, name: string) =>
  container.querySelector(`input[name="${name}"]`) as HTMLInputElement

describe('Tracing URL', () => {
  test.each([
    ['/tracing?channel=chat%3Aindex', 'Channel', 'channel', 'chat:index'],
    ['/tracing?user=42', 'User', 'user', '42'],
    ['/tracing?client_id=abc-1', 'Client', 'clientId', 'abc-1'],
  ])('cross-link %s opens its tab pre-filled', (url, tab, name, value) => {
    const { container } = renderAt(url)
    expect(selectedTab()).toBe(tab)
    expect(input(container, name).value).toBe(value)
  })

  test('switching tabs keeps only the tab in the URL and survives a refresh', () => {
    const { unmount } = renderAt('/tracing?channel=chat')
    fireEvent.click(screen.getByRole('tab', { name: 'User' }))
    expect(selectedTab()).toBe('User')
    expect(search).toBe('?tab=user')
    unmount()

    const { container } = renderAt(`/tracing${search}`)
    expect(selectedTab()).toBe('User')
    expect(input(container, 'user').value).toBe('')
  })

  test('the default tab leaves the URL clean', () => {
    renderAt('/tracing?tab=client')
    expect(selectedTab()).toBe('Client')
    fireEvent.click(screen.getByRole('tab', { name: 'Channel' }))
    expect(search).toBe('')
  })
})
