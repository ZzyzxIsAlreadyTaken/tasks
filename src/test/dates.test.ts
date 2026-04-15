import { describe, expect, it } from 'vitest'
import {
  formatHumanDate,
  getTodayIsoDate,
  isIsoDate,
  shiftIsoDate,
} from '~/lib/dates'

describe('date helpers', () => {
  it('validates iso dates', () => {
    expect(isIsoDate('2026-04-15')).toBe(true)
    expect(isIsoDate('2026-15-15')).toBe(false)
  })

  it('shifts dates by a number of days', () => {
    expect(shiftIsoDate('2026-04-15', 1)).toBe('2026-04-16')
    expect(shiftIsoDate('2026-04-15', -1)).toBe('2026-04-14')
  })

  it('formats a human readable label', () => {
    expect(formatHumanDate('2026-04-15')).toContain('April')
    expect(getTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
