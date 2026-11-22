import { describe, it, expect } from 'vitest'
import { calculateAnkiReview, previewAnkiIntervals, formatIntervalDays } from '../src/utils/ankiSrs'

describe('Anki SRS Algorithm & Interval Previews', () => {
  it('formatIntervalDays formats days, months, and years concisely', () => {
    expect(formatIntervalDays(1)).toBe('1d')
    expect(formatIntervalDays(14)).toBe('14d')
    expect(formatIntervalDays(30)).toBe('1mo')
    expect(formatIntervalDays(45)).toBe('1.5mo')
    expect(formatIntervalDays(365)).toBe('1y')
    expect(formatIntervalDays(548)).toBe('1.5y')
  })

  it('previewAnkiIntervals returns Anki learning steps for New / Learning / Relearning cards', () => {
    for (const state of [0, 1, 3] as const) {
      const previews = previewAnkiIntervals({ state, interval: 0, easeFactor: 2.5 })
      expect(previews).toEqual({
        1: '1m',
        2: '5m',
        3: '1d',
        4: '4d'
      })
    }
  })

  it('previewAnkiIntervals computes deterministic Review intervals matching calculateAnkiReview', () => {
    const previews = previewAnkiIntervals({ state: 2, interval: 10, easeFactor: 2.5 })
    // Again: 10m
    // Hard: max(11, round(10 * 1.2)) = 12d
    // Good: max(11, round(10 * 2.5)) = 25d
    // Easy: max(11, round(10 * (2.5 + 0.15) * 1.3)) = round(34.45) = 34d -> 1.1mo
    expect(previews[1]).toBe('10m')
    expect(previews[2]).toBe('12d')
    expect(previews[3]).toBe('25d')
    expect(previews[4]).toBe('1.1mo')
  })

  it('previewAnkiIntervals safely handles undefined or sub-minimum easeFactor', () => {
    const previews = previewAnkiIntervals({ state: 2, interval: 2, easeFactor: 1.0 })
    // easeFactor clamps/defaults to 2.5 when < 1.3
    expect(previews[2]).toBe('3d')
    expect(previews[3]).toBe('5d')
    expect(previews[4]).toBe('7d')
  })

  it('calculateAnkiReview handles all 4 ratings cleanly on Review cards', () => {
    const now = new Date('2026-11-22T10:00:00.000Z')
    const base = { state: 2 as const, interval: 10, easeFactor: 2.5, lapses: 0, repetitions: 3 }

    const again = calculateAnkiReview(base, 1, now)
    expect(again.progress.state).toBe(3)
    expect(again.progress.lapses).toBe(1)
    expect(again.progress.interval).toBe(0)
    expect(again.progress.easeFactor).toBeCloseTo(2.3, 5)

    const hard = calculateAnkiReview(base, 2, now)
    expect(hard.progress.state).toBe(2)
    expect(hard.progress.easeFactor).toBeCloseTo(2.35, 5)
    expect(hard.progress.interval).toBeGreaterThanOrEqual(10)

    const good = calculateAnkiReview(base, 3, now)
    expect(good.progress.state).toBe(2)
    expect(good.progress.easeFactor).toBeCloseTo(2.5, 5)
    expect(good.progress.interval).toBeGreaterThanOrEqual(21)

    const easy = calculateAnkiReview(base, 4, now)
    expect(easy.progress.state).toBe(2)
    expect(easy.progress.easeFactor).toBeCloseTo(2.65, 5)
    expect(easy.progress.interval).toBeGreaterThanOrEqual(30)
  })
})
