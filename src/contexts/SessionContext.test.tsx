import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import { Can, hasPermission, Session, SessionContext } from './SessionContext'

const viewer: Session = {
  user: { name: 'jane@example.com', auth: 'oidc', role: 'viewer' },
  permissions: ['ops:read', 'channels:read', 'clients:read', 'push:read'],
}

const Probe = () => {
  return (
    <>
      <Can permission="channels:read">
        <span>read</span>
      </Can>
      <Can permission="clients:write">
        <span>write</span>
      </Can>
    </>
  )
}

describe('SessionContext', () => {
  test('shows only what the session permits', () => {
    render(
      <SessionContext.Provider value={viewer}>
        <Probe />
      </SessionContext.Provider>
    )
    expect(screen.queryByText('read')).toBeTruthy()
    expect(screen.queryByText('write')).toBeNull()
    expect(hasPermission(viewer, 'ops:read')).toBe(true)
    expect(hasPermission(viewer, 'channels:write')).toBe(false)
  })

  test('without a session (OSS, older server) everything is allowed', () => {
    render(<Probe />)
    expect(screen.queryByText('read')).toBeTruthy()
    expect(screen.queryByText('write')).toBeTruthy()
    expect(hasPermission(null, 'channels:write')).toBe(true)
  })
})
