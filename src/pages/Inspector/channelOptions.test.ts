import { describe, it, expect } from 'vitest'

import { channelRest, resolveChannel } from './channelOptions'

const cfg = {
  channel: {
    namespace_boundary: ':',
    private_prefix: '$',
    without_namespace: { presence: true },
    namespaces: [{ name: 'news', history_size: 10 }],
  },
}

describe('resolveChannel', () => {
  it('resolves a channel without a namespace to without_namespace options', () => {
    expect(resolveChannel('index', cfg)).toEqual({
      channel: 'index',
      namespace: null,
      known: true,
      options: { presence: true },
    })
  })

  it('resolves a namespaced channel to that namespace', () => {
    const r = resolveChannel('news:index', cfg)
    expect(r.namespace).toBe('news')
    expect(r.known).toBe(true)
    expect(r.options.history_size).toBe(10)
  })

  it('marks a channel in an unconfigured namespace as unknown', () => {
    expect(resolveChannel('nope:index', cfg)).toEqual({
      channel: 'nope:index',
      namespace: 'nope',
      known: false,
      options: {},
    })
  })

  it('strips the private prefix before finding the namespace', () => {
    const r = resolveChannel('$news:index', cfg)
    expect(r.namespace).toBe('news')
    expect(r.known).toBe(true)
    expect(r.options.history_size).toBe(10)
  })

  it('treats an empty namespace part as without_namespace', () => {
    const r = resolveChannel(':index', cfg)
    expect(r.namespace).toBeNull()
    expect(r.known).toBe(true)
    expect(r.options).toEqual({ presence: true })
  })

  it('does not strip a private prefix the server does not use', () => {
    const noPrefix = {
      channel: { ...cfg.channel, private_prefix: '' },
    }
    const r = resolveChannel('$news:index', noPrefix)
    expect(r.namespace).toBe('$news')
    expect(r.known).toBe(false)
  })

  it('does not split at all when the boundary is disabled', () => {
    const noBoundary = {
      channel: { ...cfg.channel, namespace_boundary: '' },
    }
    const r = resolveChannel('news:index', noBoundary)
    expect(r.namespace).toBeNull()
    expect(r.options).toEqual({ presence: true })
  })

  it('falls back to server defaults when the config omits the fields', () => {
    const r = resolveChannel('$news:index', {
      channel: { namespaces: [{ name: 'news', history_size: 10 }] },
    })
    expect(r.namespace).toBe('news')
    expect(r.known).toBe(true)
  })
})

describe('channelRest', () => {
  it('returns the whole channel when there is no boundary in it', () => {
    expect(channelRest('index', ':')).toBe('index')
  })

  it('returns the part after the first boundary', () => {
    expect(channelRest('news:index:2', ':')).toBe('index:2')
  })

  it('keeps the private prefix out of the rest', () => {
    expect(channelRest('$news:index', ':')).toBe('index')
  })

  it('returns the whole channel when the boundary is disabled', () => {
    expect(channelRest('news:index', '')).toBe('news:index')
  })
})
