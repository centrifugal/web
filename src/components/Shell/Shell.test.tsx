import { render, screen } from '@testing-library/react'
import { MemoryRouter as Router } from 'react-router-dom'

import { Shell, ShellProps } from './Shell'

const ShellStub = (overrides: Partial<ShellProps> = {}) => {
  return (
    <Router>
      <Shell appNeedsUpdate={false} handleLogin={(password: string) => {}} handleLogout={() => {}} authenticated={true} insecure={false} {...overrides} />
    </Router>
  )
}

describe('Shell', () => {
  test('can be opened', () => {
    render(<ShellStub />)
    const elems = screen.getAllByText('CENTRIFUGO')
    expect(elems).toHaveLength(2)
  })
})
