import { render, screen } from '@testing-library/react'
import { MemoryRouter as Router } from 'react-router-dom'

import { Shell, ShellProps } from './Shell'

const ShellStub = (overrides: Partial<ShellProps> = {}) => {
  return (
    <Router>
      <Shell
        handleLogin={(password: string) => {}}
        handleLogout={() => {}}
        passwordAuthenticated={true}
        edition={'oss'}
        {...overrides}
      />
    </Router>
  )
}

describe('Shell', () => {
  test('can be opened', () => {
    render(<ShellStub />)
    const elems = screen.getAllByText('Centrifugo')
    expect(elems).toHaveLength(2)
  })
})
