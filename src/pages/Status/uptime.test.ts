import { formatUptime } from './uptime'

describe('formatUptime', () => {
  it('keeps zero units below the largest one', () => {
    expect(formatUptime(0)).toBe('0s')
    expect(formatUptime(5)).toBe('05s')
    expect(formatUptime(60)).toBe('01m 00s')
    expect(formatUptime(3605)).toBe('01h 00m 05s')
    expect(formatUptime(86400)).toBe('1d 00h 00m 00s')
    expect(formatUptime(31536000 + 61)).toBe('1y 0d 00h 01m 01s')
  })
})
