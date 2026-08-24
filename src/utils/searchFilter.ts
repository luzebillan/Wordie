export interface CardFilterState {
  query: string
  type: string // 'All' | 'Useful Expressions' | 'Glossary' | 'Daily Words' | 'Ready Versions'
  status: 'all' | 'due' | 'new' | 'learning' | 'mature' | 'leech'
  label: string // 'All' | specific label
  style: string // 'All' | 'Formal' | 'Informal' | 'General'
  hasImage: 'all' | 'with_image' | 'without_image'
  timeRange: 'all' | 'today' | '7days' | '30days'
  sortBy: 'relevance' | 'createdAt_desc' | 'createdAt_asc' | 'nextReviewDate_asc' | 'lapses_desc' | 'useCount_desc'
}

export const DEFAULT_FILTER_STATE: CardFilterState = {
  query: '',
  type: 'All',
  status: 'all',
  label: 'All',
  style: 'All',
  hasImage: 'all',
  timeRange: 'all',
  sortBy: 'relevance'
}

export interface StatusCounts {
  total: number
  due: number
  leeches: number
  newCards: number
  withImages: number
}

/**
 * Checks if a card is currently due for review based on nextReviewDate.
 */
export function isCardDue(card: any, now: Date = new Date()): boolean {
  if (!card.nextReviewDate) return true
  try {
    return new Date(card.nextReviewDate) <= now
  } catch {
    return true
  }
}

/**
 * Categorizes a card into primary memory/learning status.
 */
export function getCardStatus(card: any, now: Date = new Date()): 'leech' | 'due' | 'new' | 'learning' | 'mature' | 'review' {
  const lapses = card.lapses || 0
  const reps = card.repetitions || 0
  const state = card.state ?? 0
  const interval = card.interval || 0

  if (lapses >= 3) return 'leech'
  if (isCardDue(card, now)) return 'due'
  if (reps === 0 && (state === 0 || state === undefined)) return 'new'
  if (state === 1 || state === 3) return 'learning'
  if (interval >= 21) return 'mature'
  return 'review'
}

/**
 * Computes counts for quick filter chips.
 */
export function computeStatusCounts(cards: any[], now: Date = new Date()): StatusCounts {
  let due = 0
  let leeches = 0
  let newCards = 0
  let withImages = 0

  for (const card of cards) {
    if (isCardDue(card, now)) due++
    if ((card.lapses || 0) >= 3) leeches++
    if ((card.repetitions || 0) === 0 && (card.state === 0 || card.state === undefined)) newCards++
    if (card.imageUrl) withImages++
  }

  return {
    total: cards.length,
    due,
    leeches,
    newCards,
    withImages
  }
}

/**
 * Parses power search syntax e.g. "is:due tag:Tech style:Formal apple"
 */
export function parseSearchSyntax(rawQuery: string): { cleanQuery: string; parsedFilters: Partial<CardFilterState> } {
  const parsedFilters: Partial<CardFilterState> = {}
  let text = rawQuery

  // Match is:xxx or has:xxx
  const isMatches = text.match(/\b(is|has):(\w+)\b/gi)
  if (isMatches) {
    for (const match of isMatches) {
      const [_, op, val] = match.match(/\b(is|has):(\w+)\b/i) || []
      const v = (val || '').toLowerCase()
      if (v === 'due') parsedFilters.status = 'due'
      else if (v === 'new') parsedFilters.status = 'new'
      else if (v === 'leech' || v === 'leeches' || v === 'difficult') parsedFilters.status = 'leech'
      else if (v === 'learning') parsedFilters.status = 'learning'
      else if (v === 'mature' || v === 'mastered') parsedFilters.status = 'mature'
      else if (v === 'image' || v === 'images' || v === 'picture') parsedFilters.hasImage = 'with_image'

      text = text.replace(match, ' ')
    }
  }

  // Match tag:xxx or label:xxx (supports quotes and nested slashes)
  const tagMatch = text.match(/\b(tag|label):(?:"([^"]+)"|'([^']+)'|([\w\u4e00-\u9fa5\/-]+))/i)
  if (tagMatch) {
    parsedFilters.label = (tagMatch[2] || tagMatch[3] || tagMatch[4] || '').trim()
    text = text.replace(tagMatch[0], ' ')
  }

  // Match type:xxx
  const typeMatch = text.match(/\btype:([\w\u4e00-\u9fa5-]+)\b/i)
  if (typeMatch) {
    const rawType = typeMatch[1].toLowerCase()
    if (rawType.includes('expression')) parsedFilters.type = 'Useful Expressions'
    else if (rawType.includes('glossary')) parsedFilters.type = 'Glossary'
    else if (rawType.includes('daily')) parsedFilters.type = 'Daily Words'
    else if (rawType.includes('ready')) parsedFilters.type = 'Ready Versions'
    text = text.replace(typeMatch[0], ' ')
  }

  // Match style:xxx
  const styleMatch = text.match(/\bstyle:([\w\u4e00-\u9fa5-]+)\b/i)
  if (styleMatch) {
    const rawStyle = styleMatch[1].toLowerCase()
    if (rawStyle === 'formal') parsedFilters.style = 'Formal'
    else if (rawStyle === 'informal') parsedFilters.style = 'Informal'
    else if (rawStyle === 'general') parsedFilters.style = 'General'
    text = text.replace(styleMatch[0], ' ')
  }

  const cleanQuery = text.trim().replace(/\s+/g, ' ')
  return { cleanQuery, parsedFilters }
}

/**
 * Evaluates whether a card falls within a given time range based on createdAt.
 */
function matchesTimeRange(createdAt: string | undefined, timeRange: CardFilterState['timeRange'], now: Date): boolean {
  if (timeRange === 'all' || !createdAt) return true
  try {
    const date = new Date(createdAt)
    const diffMs = now.getTime() - date.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    if (timeRange === 'today') {
      return date.toDateString() === now.toDateString()
    } else if (timeRange === '7days') {
      return diffDays <= 7
    } else if (timeRange === '30days') {
      return diffDays <= 30
    }
  } catch {
    return true
  }
  return true
}

/**
 * Universal Card Filter & Sort Engine
 */
export function filterAndSortCards(cards: any[], filters: CardFilterState, now: Date = new Date()): any[] {
  const query = (filters.query || '').trim().toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)

  const filtered = cards.filter(card => {
    // 1. Type Filter
    if (filters.type !== 'All' && card.type !== filters.type) {
      return false
    }

    // 2. Status Filter
    if (filters.status !== 'all') {
      const isDue = isCardDue(card, now)
      const lapses = card.lapses || 0
      const reps = card.repetitions || 0
      const state = card.state ?? 0
      const interval = card.interval || 0

      if (filters.status === 'due' && !isDue) return false
      if (filters.status === 'leech' && lapses < 3) return false
      if (filters.status === 'new' && (reps > 0 || (state !== 0 && state !== undefined))) return false
      if (filters.status === 'learning' && state !== 1 && state !== 3) return false
      if (filters.status === 'mature' && interval < 21) return false
    }

    // 3. Label Filter
    if (filters.label !== 'All') {
      const cardLabel = (card.label || '').toLowerCase()
      const filterLabel = filters.label.toLowerCase()
      if (cardLabel !== filterLabel && !cardLabel.includes(filterLabel)) {
        return false
      }
    }

    // 4. Style Filter
    if (filters.style !== 'All') {
      if ((card.style || '') !== filters.style) {
        return false
      }
    }

    // 5. Image Attachment Filter
    if (filters.hasImage === 'with_image' && !card.imageUrl) return false
    if (filters.hasImage === 'without_image' && !!card.imageUrl) return false

    // 6. Time Range Filter
    if (filters.timeRange !== 'all') {
      if (!matchesTimeRange(card.createdAt, filters.timeRange, now)) {
        return false
      }
    }

    // 7. Keyword / Text Search
    if (query) {
      const front = (card.front || '').toLowerCase()
      const back = (card.back || '').toLowerCase()
      const label = (card.label || '').toLowerCase()
      const style = (card.style || '').toLowerCase()
      const context = (card.sourceContext || '').toLowerCase()

      const fullMatch =
        front.includes(query) ||
        back.includes(query) ||
        label.includes(query) ||
        style.includes(query) ||
        context.includes(query)

      if (!fullMatch) {
        if (tokens.length > 1) {
          const allTokensMatch = tokens.every(t =>
            front.includes(t) ||
            back.includes(t) ||
            label.includes(t) ||
            style.includes(t) ||
            context.includes(t)
          )
          if (!allTokensMatch) return false
        } else {
          return false
        }
      }
    }

    return true
  })

  // Sorting
  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'createdAt_desc':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      case 'createdAt_asc':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      case 'nextReviewDate_asc':
        return new Date(a.nextReviewDate || 0).getTime() - new Date(b.nextReviewDate || 0).getTime()
      case 'lapses_desc':
        return (b.lapses || 0) - (a.lapses || 0)
      case 'useCount_desc':
        return (b.useCount || 0) - (a.useCount || 0)
      case 'relevance':
      default: {
        if (!query) {
          // Default to newest created first when no search query
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        }
        const getScore = (card: any) => {
          const f = (card.front || '').toLowerCase()
          const l = (card.label || '').toLowerCase()
          const s = (card.style || '').toLowerCase()
          const b = (card.back || '').toLowerCase()
          const c = (card.sourceContext || '').toLowerCase()

          let score = 0
          if (f === query) score += 1000
          else if (f.startsWith(query)) score += 500
          else if (f.includes(query)) score += 250

          if (l === query || s === query) score += 150
          else if (l.includes(query) || s.includes(query)) score += 80

          if (b.includes(query)) score += 60
          if (c.includes(query)) score += 30

          for (const t of tokens) {
            if (f.includes(t)) score += 40
            if (b.includes(t)) score += 15
          }
          return score
        }
        return getScore(b) - getScore(a)
      }
    }
  })

  return filtered
}
