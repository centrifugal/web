import { describe, test, expect } from 'vitest'

import { pageTitle } from './pageTitle'

describe('pageTitle', () => {
  test('puts the most specific part first', () => {
    expect(pageTitle('Trends', 'Analytics')).toBe(
      'Trends · Analytics · Centrifugo'
    )
    expect(pageTitle()).toBe('Centrifugo')
  })
})
