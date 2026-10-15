import { describe, it, expect } from 'vitest'
import {
  parseSearchSyntax,
  filterAndSortCards,
  computeStatusCounts,
  isCardDue,
  DEFAULT_FILTER_STATE,
  isDefaultFilterState,
  removeSyntaxFromQuery,
  getEffectiveFilters,
  getSyntaxSuggestions,
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

  it('Preserves spaces, trailing spaces, and multiple words in search queries without syntax', () => {
    expect(parseSearchSyntax('apple ').cleanQuery).toBe('apple ')
    expect(parseSearchSyntax('apple pie').cleanQuery).toBe('apple pie')
    expect(parseSearchSyntax('apple pie ').cleanQuery).toBe('apple pie ')
    expect(parseSearchSyntax(' ').cleanQuery).toBe(' ')
    expect(parseSearchSyntax('take care of ').cleanQuery).toBe('take care of ')
  })

  it('Preserves trailing space when combined with syntax and typing keywords', () => {
    const { cleanQuery, parsedFilters } = parseSearchSyntax('is:due mitigate ')
    expect(cleanQuery).toBe('mitigate ')
    expect(parsedFilters.status).toBe('due')
  })

  it('Does not erase unknown is: or type: words from search query', () => {
    const { cleanQuery, parsedFilters } = parseSearchSyntax('this is:unknown test')
    expect(cleanQuery).toBe('this is:unknown test')
    expect(parsedFilters).toEqual({})
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

  it('Filters cards with inline syntax in query (is:due mitigate)', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, query: 'is:due mitigate' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('mitigate')
  })

  it('Filters cards with inline syntax only (is:due)', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, query: 'is:due' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result.map(c => c.id).sort()).toEqual([1, 3])
  })

  it('Filters cards with multi-word queries and spaces', () => {
    const filters: CardFilterState = { ...DEFAULT_FILTER_STATE, query: 'call it a day' }
    const result = filterAndSortCards(mockCards, filters, fixedNow)
    expect(result).toHaveLength(1)
    expect(result[0].front).toBe('call it a day')
  })

  it('Removes syntax tokens non-destructively with removeSyntaxFromQuery', () => {
    expect(removeSyntaxFromQuery('is:due tag:Tech apple')).toBe('apple')
    expect(removeSyntaxFromQuery('is:due tag:Tech apple', ['status'])).toBe('tag:Tech apple')
    expect(removeSyntaxFromQuery('is:due apple ', ['status'])).toBe('apple ')
    expect(removeSyntaxFromQuery('is:due', ['status'])).toBe('')
    expect(removeSyntaxFromQuery('take care of ')).toBe('take care of ')
  })

  it('Resolves effective filters correctly via getEffectiveFilters', () => {
    const filters: CardFilterState = {
      ...DEFAULT_FILTER_STATE,
      status: 'learning',
      query: 'is:due tag:Tech mitigate'
    }
    const effective = getEffectiveFilters(filters)
    expect(effective.status).toBe('due') // inline syntax overrides default
    expect(effective.label).toBe('Tech')
    expect(effective.cleanQuery).toBe('mitigate')
  })

  it('Handles incomplete syntax tokens cleanly without polluting keyword query or zeroing search results', () => {
    // Incomplete operators should not be treated as literal keywords
    expect(parseSearchSyntax('is:').cleanQuery).toBe('')
    expect(parseSearchSyntax('tag:').cleanQuery).toBe('')
    expect(parseSearchSyntax('style:').cleanQuery).toBe('')
    expect(parseSearchSyntax('apple is:').cleanQuery).toBe('apple')
    expect(parseSearchSyntax('apple tag:').cleanQuery).toBe('apple')
    expect(parseSearchSyntax('tag:"Business English" apple').parsedFilters.label).toBe('Business English')
    expect(parseSearchSyntax('tag:"Business English" apple').cleanQuery).toBe('apple')

    // Cards must NOT vanish when user is typing an incomplete operator
    const result1 = filterAndSortCards(mockCards, { ...DEFAULT_FILTER_STATE, query: 'is:' }, fixedNow)
    expect(result1.length).toBe(mockCards.length)

    const result2 = filterAndSortCards(mockCards, { ...DEFAULT_FILTER_STATE, query: 'mitigate is:' }, fixedNow)
    expect(result2).toHaveLength(1)
    expect(result2[0].front).toBe('mitigate')
  })

  it('Supports real-time prefix matching for status, type, and style', () => {
    // is:d maps to due
    const { parsedFilters: dueFilters } = parseSearchSyntax('is:d')
    expect(dueFilters.status).toBe('due')

    // is:n maps to new
    const { parsedFilters: newFilters } = parseSearchSyntax('is:n')
    expect(newFilters.status).toBe('new')

    // type:exp maps to Useful Expressions
    const { parsedFilters: expFilters } = parseSearchSyntax('type:exp')
    expect(expFilters.type).toBe('Useful Expressions')

    // style:for maps to Formal
    const { parsedFilters: styleFilters } = parseSearchSyntax('style:for')
    expect(styleFilters.style).toBe('Formal')
  })

  it('Provides dynamic syntax suggestions via getSyntaxSuggestions', () => {
    const suggestions1 = getSyntaxSuggestions('is:')
    expect(suggestions1.some(s => s.token === 'is:due')).toBe(true)
    expect(suggestions1.some(s => s.token === 'is:new')).toBe(true)

    const suggestions2 = getSyntaxSuggestions('tag:', ['Business', 'Tech', 'Medical'])
    expect(suggestions2.some(s => s.token === 'tag:Business')).toBe(true)
    expect(suggestions2.some(s => s.token === 'tag:Tech')).toBe(true)

    const suggestions3 = getSyntaxSuggestions('apple pie')
    expect(suggestions3).toHaveLength(0) // No suggestions for ordinary words
  })

  it('Accurately checks default filter state via isDefaultFilterState', () => {
    expect(isDefaultFilterState(DEFAULT_FILTER_STATE)).toBe(true)
    expect(isDefaultFilterState({ ...DEFAULT_FILTER_STATE, query: '   ' })).toBe(true)
    expect(isDefaultFilterState({ ...DEFAULT_FILTER_STATE, query: 'apple' })).toBe(false)
    expect(isDefaultFilterState({ ...DEFAULT_FILTER_STATE, status: 'due' })).toBe(false)
    expect(isDefaultFilterState({ ...DEFAULT_FILTER_STATE, type: 'Glossary' })).toBe(false)
  })
})
