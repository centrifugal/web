import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import {
  Can,
  hasPermission,
  roleLabel,
  Session,
  SessionContext,
} from './SessionContext'

const viewer: Session = {
  user: {
    name: 'jane@example.com',
    auth: 'oidc',
    role: 'viewer',
    roles: ['viewer'],
  },
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

  test('without a session (OSS) everything is allowed', () => {
    render(<Probe />)
    expect(screen.queryByText('read')).toBeTruthy()
    expect(screen.queryByText('write')).toBeTruthy()
    expect(hasPermission(null, 'channels:write')).toBe(true)
  })
})

describe('roleLabel', () => {
  test('names every role', () => {
    const user = { name: 'jane', auth: 'oidc', role: 'viewer' }
    expect(
      roleLabel({ user: { ...user, roles: ['viewer'] }, permissions: [] })
    ).toBe('viewer')
    expect(
      roleLabel({
        user: { ...user, roles: ['viewer', 'support'] },
        permissions: [],
      })
    ).toBe('viewer, support')
  })
})
