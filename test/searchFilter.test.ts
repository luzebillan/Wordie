import { describe, it, expect } from 'vitest'
import {
  parseSearchSyntax,
  filterAndSortCards,
  computeStatusCounts,
  isCardDue,
  DEFAULT_FILTER_STATE,
  type CardFilterState
} from '../src/utils/searchFilter'

describe('Universal Search & Filter Engine', () => {
  const fixedNow = new Date('2026-08-24T12:00:00Z')
  const pastDate = new Date('2026-08-20T12:00:00Z').toISOString()
  const futureDate = new Date('2026-08-28T12:00:00Z').toISOString()

  const mockCards = [
    {
      id: 1,
      front: 'mitigate',
      back: 'To make less severe or serious',
      type: 'Useful Expressions',
      style: 'Formal',
      label: 'Business',
      nextReviewDate: pastDate, // Due
      lapses: 4, // Leech
      repetitions: 5,
      interval: 10,
      createdAt: '2026-08-23T10:00:00Z',
      imageUrl: 'img1.png'
    },
    {
      id: 2,
      front: 'call it a day',
      back: 'Stop working on something',
      type: 'Useful Expressions',
      style: 'Informal',
      label: 'General',
      nextReviewDate: futureDate, // Not due
      lapses: 0,
      repetitions: 10,
      interval: 30, // Mature
      createdAt: '2026-08-01T10:00:00Z'
    },
    {
      id: 3,
      front: 'stethoscope',
      back: 'Medical acoustic instrument for listening to the heart',
      type: 'Glossary',
      style: 'Formal',
      label: 'Medical',
      nextReviewDate: pastDate, // Due
      lapses: 1,
      repetitions: 0, // New
      state: 0,
      interval: 0,
      createdAt: '2026-08-24T08:00:00Z'
    },
    {
      id: 4,
      front: '人工智能',
      back: 'AI and neural networks',
      type: 'Glossary',
      style: 'Formal',
      label: 'Tech',
      nextReviewDate: futureDate,
      lapses: 0,
      repetitions: 2,
      state: 1, // Learning
      interval: 3,
      createdAt: '2026-08-20T10:00:00Z',
      imageUrl: 'ai.png'
    }
  ]

  it('Parses search syntax accurately (is:due tag:Medical apple)', () => {
    const { cleanQuery, parsedFilters } = parseSearchSyntax('is:due tag:Medical style:Formal mitigate')
    expect(cleanQuery).toBe('mitigate')
    expect(parsedFilters.status).toBe('due')
    expect(parsedFilters.label).toBe('Medical')
    expect(parsedFilters.style).toBe('Formal')
  })

  it('Parses is:leech and is:image modifiers', () => {
    const { cleanQuery, parsedFilters } = parseSearchSyntax('is:leech has:image cardiology')
    expect(cleanQuery).toBe('cardiology')
    expect(parsedFilters.status).toBe('leech')
    expect(parsedFilters.hasImage).toBe('with_image')
  })

  it('Computes status counts correctly', () => {
    const counts = computeStatusCounts(mockCards, fixedNow)
    expect(counts.total).toBe(4)
    expect(counts.due).toBe(2) // Cards 1, 3
    expect(counts.leeches).toBe(1) // Card 1 (lapses >= 3)
    expect(counts.newCards).toBe(1) // Card 3 (reps == 0 && state == 0)
    expect(counts.withImages).toBe(2) // Cards 1, 4
  })

  it('Filters by status: due', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, status: 'due' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result.map(c => c.id)).toEqual([3, 1]) // sorted by createdAt_desc default
  })

  it('Filters by status: leech (high lapses)', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, status: 'leech' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('Filters by status: mature', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, status: 'mature' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(2)
  })

  it('Filters by label / domain and type', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, type: 'Glossary', label: 'Medical' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('stethoscope')
  })

  it('Filters by image attachment', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, hasImage: 'with_image' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result.map(c => c.id).sort()).toEqual([1, 4])
  })

  it('Filters by timeRange: today', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, timeRange: 'today' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(3)
  })

  it('Sorts by lapses descending', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, sortBy: 'lapses_desc' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result[0].id).toBe(1) // lapses = 4
  })
})
