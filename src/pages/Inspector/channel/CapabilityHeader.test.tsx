import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'

import { CapabilityHeader } from './CapabilityHeader'
import { ResolvedChannel } from '../channelOptions'

const resolved = (over: Partial<ResolvedChannel> = {}): ResolvedChannel => ({
  channel: 'digits:42',
  namespace: 'digits',
  known: true,
  options: { channel_regex: '^\\d+$' },
  verified: true,
  ...over,
})

describe('CapabilityHeader', () => {
  test('renders the server verdict when the name is accepted', () => {
    render(<CapabilityHeader resolved={resolved({ nameValid: true })} />)
    expect(screen.getByText('name matches')).toBeTruthy()
    expect(screen.queryByText(/would be rejected/)).toBeNull()
  })

  test('renders the server verdict when the name is rejected', () => {
    render(<CapabilityHeader resolved={resolved({ nameValid: false })} />)
    expect(screen.getByText(/would be rejected/)).toBeTruthy()
  })

  // The regex is still shown - the operator asked about this channel - but with no
  // verdict attached, because only the server can decide which string it is matched
  // against (a pattern channel is matched whole, a namespaced one only past the
  // boundary) and this server did not say.
  test('shows no verdict when the server did not answer one', () => {
    render(<CapabilityHeader resolved={resolved({ nameValid: undefined })} />)
    expect(screen.getByText(/channel_regex/)).toBeTruthy()
    expect(screen.queryByText('name matches')).toBeNull()
    expect(screen.queryByText(/would be rejected/)).toBeNull()
  })

  test('an unknown namespace is called a rejection only when the server said so', () => {
    render(
      <CapabilityHeader
        resolved={resolved({ known: false, namespace: 'nope', verified: true })}
      />
    )
    expect(screen.getByText(/would reject subscriptions/)).toBeTruthy()
  })

  // This is the case that used to render a false warning and hide every live panel
  // for a perfectly valid channel: the client-side fallback mis-resolves a
  // private-prefixed or pattern channel and reports its namespace as unknown.
  test('an unverified resolution never claims Centrifugo would reject', () => {
    render(
      <CapabilityHeader
        resolved={resolved({
          known: false,
          namespace: '$news',
          verified: false,
        })}
      />
    )
    expect(screen.queryByText(/would reject subscriptions/)).toBeNull()
    expect(
      screen.getByText(/resolved from its configuration in the browser/)
    ).toBeTruthy()
  })

  test('marks a pattern-matched channel', () => {
    render(<CapabilityHeader resolved={resolved({ pattern: true })} />)
    expect(screen.getByText('pattern')).toBeTruthy()
  })
})
