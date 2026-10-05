import { describe, test, expect } from 'vitest'

import { licenseChipColor, licenseDateText, formatLicenseDate } from './license'

describe('licenseDateText', () => {
  const at = Date.UTC(2027, 2, 1, 12) / 1000

  test('label and date', () => {
    expect(
      licenseDateText({ label: 'Expires', at, severity: 'ok', hint: '' })
    ).toBe(`Expires ${formatLicenseDate(at)}`)
  })

  test('note follows the date', () => {
    expect(
      licenseDateText({
        label: 'Expired',
        at,
        note: 'no updates',
        severity: 'error',
        hint: '',
      })
    ).toBe(`Expired ${formatLicenseDate(at)} · no updates`)
  })
})

test('licenseChipColor', () => {
  expect(licenseChipColor('ok')).toBe('default')
  expect(licenseChipColor('warning')).toBe('warning')
  expect(licenseChipColor('error')).toBe('error')
})
