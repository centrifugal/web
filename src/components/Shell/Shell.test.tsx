import { render } from '@testing-library/react'
import { MemoryRouter as Router } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import { act } from '@testing-library/react'

import { Shell, ShellProps } from './Shell'

const ShellStub = (overrides: Partial<ShellProps> = {}) => {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <Shell
          handleLogin={async (password: string) => {}}
          handleLogout={() => {}}
          passwordAuthenticated={true}
          edition={'oss'}
          {...overrides}
        />
      </AuthProvider>
    </Router>
  )
}

describe('Shell', () => {
  test('can be opened', async () => {
    let container: HTMLElement
    await act(async () => {
      const result = render(<ShellStub />)
      container = result.container
    })
    expect(container!).toBeInTheDocument()
  })
})
