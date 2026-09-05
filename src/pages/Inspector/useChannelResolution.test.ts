import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, test, expect } from 'vitest'

import { useChannelResolution } from './useChannelResolution'
import { InspectorApi } from './types'
import { ResolvedChannel } from './channelOptions'
import { ServerConfig } from './useServerConfig'

const makeApi = (adminGet: InspectorApi['adminGet']): InspectorApi => ({
  adminGet,
  call: vi.fn(),
  showAlert: vi.fn(),
})

const makeServer = (resolve: (ch: string) => ResolvedChannel | null) =>
  ({ resolve }) as unknown as ServerConfig

// Nothing here should ever run: these tests assert the hook takes what the server
// says instead of re-deriving it, so the fallback resolver is only reached when the
// endpoint actually fails.
const unusedServer = makeServer(() => {
  throw new Error(
    'fallback resolver must not be used when the endpoint answers'
  )
})

describe('useChannelResolution', () => {
  test('takes the name verdict from the server rather than deriving it', async () => {
    const api = makeApi(
      vi.fn().mockResolvedValue({
        namespace: 'rooms',
        found: true,
        options: { channel_regex: '^/rooms/\\d+$' },
        name_valid: true,
        pattern: true,
      })
    )

    const { result } = renderHook(() =>
      useChannelResolution('/rooms/42', api, unusedServer)
    )

    await waitFor(() => expect(result.current.resolved).not.toBeNull())
    expect(result.current.resolved).toMatchObject({
      namespace: 'rooms',
      known: true,
      verified: true,
      nameValid: true,
      pattern: true,
    })
  })

  test('a rejected name comes back as nameValid false', async () => {
    const api = makeApi(
      vi.fn().mockResolvedValue({
        namespace: 'digits',
        found: true,
        options: { channel_regex: '^\\d+$' },
        name_valid: false,
      })
    )

    const { result } = renderHook(() =>
      useChannelResolution('digits:abc', api, unusedServer)
    )

    await waitFor(() => expect(result.current.resolved).not.toBeNull())
    expect(result.current.resolved?.nameValid).toBe(false)
  })

  // A server older than the name_valid field answers the endpoint but omits it.
  // The resolution is still the server's, so it stays verified; the verdict is
  // simply absent, and the header renders none.
  test('a server that omits name_valid leaves the verdict undefined', async () => {
    const api = makeApi(
      vi.fn().mockResolvedValue({
        namespace: 'chat',
        found: true,
        options: { presence: true },
      })
    )

    const { result } = renderHook(() =>
      useChannelResolution('chat:index', api, unusedServer)
    )

    await waitFor(() => expect(result.current.resolved).not.toBeNull())
    expect(result.current.resolved?.verified).toBe(true)
    expect(result.current.resolved?.nameValid).toBeUndefined()
    expect(result.current.resolved?.pattern).toBeUndefined()
  })

  // A server without the endpoint at all: the client-side fallback answers, and
  // must be marked unverified so the header stops short of claiming a rejection.
  test('falls back to client-side resolution, marked unverified', async () => {
    const api = makeApi(vi.fn().mockRejectedValue(new Error('404')))
    const server = makeServer(channel => ({
      channel,
      namespace: 'chat',
      known: true,
      options: { presence: true },
      verified: false,
    }))

    const { result } = renderHook(() =>
      useChannelResolution('chat:index', api, server)
    )

    await waitFor(() => expect(result.current.resolved).not.toBeNull())
    expect(result.current.resolved?.verified).toBe(false)
    expect(result.current.resolved?.nameValid).toBeUndefined()
  })

  test('falls back to a minimal resolution when config is unavailable too', async () => {
    const api = makeApi(vi.fn().mockRejectedValue(new Error('404')))
    const server = makeServer(() => null)

    const { result } = renderHook(() =>
      useChannelResolution('chat:index', api, server)
    )

    await waitFor(() => expect(result.current.resolved).not.toBeNull())
    expect(result.current.resolved).toMatchObject({
      channel: 'chat:index',
      known: true,
      verified: false,
    })
  })
})
