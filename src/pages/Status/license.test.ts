import { describe, test, expect } from 'vitest'

import {
  LICENSE_WARNING_PERIOD,
  licenseDates,
  licenseSeverity,
  licenseLimits,
  LicenseStatus,
} from './license'

const NOW = 1_800_000_000
const DAY = 24 * 60 * 60

const status = (s: Partial<LicenseStatus>): LicenseStatus => ({
  sandbox: false,
  server_time: NOW,
  ...s,
})

describe('licenseSeverity', () => {
  test('ok while more than a month is left', () => {
    expect(licenseSeverity(NOW + LICENSE_WARNING_PERIOD, NOW)).toBe('ok')
    expect(licenseSeverity(NOW + 90 * DAY, NOW)).toBe('ok')
  })
  test('warning less than a month before', () => {
    expect(licenseSeverity(NOW + LICENSE_WARNING_PERIOD - 1, NOW)).toBe(
      'warning'
    )
    expect(licenseSeverity(NOW + 1, NOW)).toBe('warning')
  })
  test('error from the date on', () => {
    expect(licenseSeverity(NOW, NOW)).toBe('error')
    expect(licenseSeverity(NOW - DAY, NOW)).toBe('error')
  })
})

describe('licenseDates', () => {
  test('no dates for a key without expiration', () => {
    expect(licenseDates(status({ owner: 'ACME' }))).toEqual([])
  })

  test('production key: updates until / ended', () => {
    expect(
      licenseDates(status({ no_updates_at: NOW + 90 * DAY }))
    ).toMatchObject([
      { kind: 'no_updates', label: 'Updates until', severity: 'ok' },
    ])
    expect(licenseDates(status({ no_updates_at: NOW - DAY }))).toMatchObject([
      { kind: 'no_updates', label: 'Updates ended', severity: 'error' },
    ])
  })

  test('trial key: expires / expired', () => {
    expect(
      licenseDates(status({ trial: true, no_start_at: NOW + 10 * DAY }))
    ).toMatchObject([
      { kind: 'no_start', label: 'Trial expires', severity: 'warning' },
    ])
    expect(
      licenseDates(status({ trial: true, no_start_at: NOW - 1 }))
    ).toMatchObject([
      { kind: 'no_start', label: 'Trial expired', severity: 'error' },
    ])
  })

  test('enforced expiration of a production key comes first', () => {
    const dates = licenseDates(
      status({ no_start_at: NOW + 10 * DAY, no_updates_at: NOW + 5 * DAY })
    )
    expect(dates.map(d => [d.kind, d.label])).toEqual([
      ['no_start', 'Valid until'],
      ['no_updates', 'Updates until'],
    ])
  })
})

test('licenseLimits', () => {
  expect(
    licenseLimits(status({ max_connections: 20, max_nodes: 2, max_api_rps: 5 }))
  ).toBe('20 connections, 2 nodes, 5 API rps')
  expect(licenseLimits(status({}))).toBe('no limits')
})
