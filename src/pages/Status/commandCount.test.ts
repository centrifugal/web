import { describe, test, expect } from 'vitest'

import { commandCount } from './Status'

const client = 'centrifugo.client.command_duration_seconds'
const api = 'centrifugo.api.command_duration_seconds'

describe('commandCount', () => {
  test('reads the summary, or the histogram with native histograms', () => {
    const summary = {
      [`${client}.count.method.connect`]: 6,
      [`${client}.count.method.subscribe`]: 4,
      [`${api}.count.method.publish`]: 2,
      [`${api}.count.method.broadcast`]: 3,
    }
    expect(commandCount(summary, client, 'connect')).toBe(6)
    expect(commandCount(summary, api)).toBe(5)

    // Summaries off: histogram series, possibly with more labels.
    const native = {
      [`${client}_histogram.count.method.connect`]: 6,
      [`${api}_histogram.count.method.publish.protocol.http`]: 2,
      [`${api}_histogram.count.method.publish.protocol.grpc`]: 1,
    }
    expect(commandCount(native, client, 'connect')).toBe(6)
    expect(commandCount(native, api)).toBe(3)

    expect(commandCount({}, api)).toBe(0)
  })

  test('labels sorted before method', () => {
    // prometheus.channel_namespace_resolution and client labels.
    const items = {
      [`${client}.count.channel_namespace.chat.method.subscribe`]: 3,
      [`${client}.count.channel_namespace.news.method.subscribe`]: 2,
      [`${client}.count.client_name.js.method.connect`]: 4,
      [`${client}.count.method.sub_refresh`]: 9,
      [`${client}.sum.method.subscribe`]: 0.5,
    }
    expect(commandCount(items, client, 'subscribe')).toBe(5)
    expect(commandCount(items, client, 'connect')).toBe(4)
  })
})
