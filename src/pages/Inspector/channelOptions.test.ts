import { describe, test, expect } from 'vitest'

import { resolveChannel } from './channelOptions'

const cfg = (channel: Record<string, unknown>) => ({
  channel: {
    without_namespace: { presence: false },
    namespaces: [{ name: 'chat', presence: true, history_size: 10 }],
    ...channel,
  },
})

describe('resolveChannel', () => {
  test('resolves a namespaced channel', () => {
    expect(resolveChannel('chat:index', cfg({}))).toMatchObject({
      channel: 'chat:index',
      namespace: 'chat',
      known: true,
      options: { presence: true, history_size: 10 },
      verified: false,
    })
  })

  // Centrifugo trims channel.private_prefix before splitting on the namespace
  // boundary, so a private channel takes its namespace's options.
  test('strips the private prefix before matching the namespace', () => {
    expect(
      resolveChannel('$chat:index', cfg({ private_prefix: '$' }))
    ).toMatchObject({
      channel: '$chat:index',
      namespace: 'chat',
      known: true,
      options: { presence: true, history_size: 10 },
    })
  })

  test('uses the default private prefix when config omits it', () => {
    expect(resolveChannel('$chat:index', cfg({}))).toMatchObject({
      namespace: 'chat',
      known: true,
    })
  })

  test('honours a custom private prefix', () => {
    expect(
      resolveChannel('!chat:index', cfg({ private_prefix: '!' }))
    ).toMatchObject({ namespace: 'chat', known: true })
  })

  test('a private channel without a namespace uses without_namespace', () => {
    expect(resolveChannel('$index', cfg({}))).toMatchObject({
      namespace: null,
      known: true,
      options: { presence: false },
    })
  })
})
