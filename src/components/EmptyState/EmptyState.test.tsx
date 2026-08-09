import { render } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

import { EmptyState } from './EmptyState'

// hint is a ReactNode, so callers pass buttons and laid-out blocks - an empty
// state whose whole job is telling someone what to do next usually wants an
// action in it. If the hint renders inside a <p>, React logs "In HTML, <div>
// cannot be a descendant of <p>" and warns about hydration.
//
// Nothing else catches this: it is not a type error, not a lint error, and the
// production build is happy. It only appears when the component is rendered,
// which is why it is worth one test.
describe('EmptyState', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts block content in hint without invalid DOM nesting', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <EmptyState
        title="Nothing here yet"
        hint={
          <>
            Some explanation of what to do next.
            <Box sx={{ mt: 2 }}>
              <Button size="small">Do the thing</Button>
            </Box>
          </>
        }
      />
    )

    const nesting = spy.mock.calls
      .map(args => args.join(' '))
      .filter(msg =>
        /cannot be a descendant of|cannot contain a nested/.test(msg)
      )
    expect(nesting).toEqual([])
  })
})
