import { describe, it, expect } from 'vitest'

import { HumanSeconds, HumanSize } from './Functions'

describe('HumanSeconds', () => {
  it('formats zero', () => {
    expect(HumanSeconds(0)).toBe('0s')
  })

  it('formats seconds only', () => {
    expect(HumanSeconds(5)).toBe('05s')
  })

  it('pads minutes and seconds', () => {
    expect(HumanSeconds(65)).toBe('01m 05s')
  })

  it('rolls minutes over into hours at the 60m boundary', () => {
    expect(HumanSeconds(3599)).toBe('59m 59s')
    expect(HumanSeconds(3600)).toBe('01h ')
  })

  it('rolls hours over into days at the 24h boundary', () => {
    expect(HumanSeconds(86399)).toBe('23h 59m 59s')
    expect(HumanSeconds(86400)).toBe('1d ')
  })

  it('floors fractional seconds instead of corrupting the padded output', () => {
    expect(HumanSeconds(65.5)).toBe('01m 05s')
    expect(HumanSeconds(5.5)).toBe('05s')
  })
})

describe('HumanSize', () => {
  it('formats bytes below the threshold as-is', () => {
    expect(HumanSize(500)).toBe('500 B')
  })

  it('formats binary units by default', () => {
    expect(HumanSize(1024)).toBe('1.0 KiB')
  })

  it('formats SI units when requested', () => {
    expect(HumanSize(1000, true)).toBe('1.0 kB')
  })

  it('respects the decimal places argument', () => {
    expect(HumanSize(1536, false, 2)).toBe('1.50 KiB')
  })
})
