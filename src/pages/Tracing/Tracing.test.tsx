import { render, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

import { Tracing } from './Tracing'

// The trace stream is decoded chunk by chunk. `TextDecoder.decode()` without
// `{ stream: true }` treats every chunk as a complete input, so a multi-byte
// UTF-8 character split across two network chunks used to decode as U+FFFD —
// corrupting the NDJSON line and making `JSON.parse` throw, which killed the
// whole trace stream rather than dropping a single character.
describe('Tracing stream decoding', () => {
  test('renders a message whose UTF-8 payload is split across chunks', async () => {
    const line = `${JSON.stringify({ type: 'pub', pub: { data: 'привет' } })}\n`
    const bytes = new TextEncoder().encode(line)
    // Split inside a multi-byte character: pick a continuation byte (10xxxxxx).
    const splitAt = bytes.findIndex(b => (b & 0xc0) === 0x80)
    expect(splitAt).toBeGreaterThan(0)

    const chunks = [bytes.slice(0, splitAt), bytes.slice(splitAt)]
    let next = 0
    const read = vi
      .fn()
      .mockImplementation(async () =>
        next < chunks.length
          ? { done: false, value: chunks[next++] }
          : { done: true, value: undefined }
      )

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => ({ read }) },
      })
    )

    const { container, getByText } = render(
      <MemoryRouter>
        <Tracing signinSilent={() => {}} authorization="" />
      </MemoryRouter>
    )

    const input = container.querySelector(
      'input[name="channel"]'
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.click(getByText('Start'))

    await waitFor(() => expect(container.textContent).toContain('привет'))
    expect(container.textContent).not.toContain('�')
  })
})
