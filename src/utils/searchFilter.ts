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

/**
 * Checks if a given filter state is equivalent to the default filter state.
 */
export function isDefaultFilterState(filters: CardFilterState): boolean {
  return (
    !filters.query.trim() &&
    filters.type === 'All' &&
    filters.status === 'all' &&
    filters.label === 'All' &&
    filters.style === 'All' &&
    filters.hasImage === 'all' &&
    filters.timeRange === 'all' &&
    filters.sortBy === 'relevance'
  )
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

export interface SyntaxTokenMatch {
  key: 'status' | 'type' | 'label' | 'style' | 'hasImage'
  rawMatch: string
  start: number
  end: number
  value?: any
  isIncomplete?: boolean
}

export interface SearchSyntaxSuggestion {
  token: string
  label: string
  description: string
  category: 'status' | 'type' | 'tag' | 'style' | 'image'
}

export const BASE_SYNTAX_SUGGESTIONS: SearchSyntaxSuggestion[] = [
  // Status
  { token: 'is:due', label: 'Due Today', description: 'Cards due for review', category: 'status' },
  { token: 'is:new', label: 'New', description: 'Fresh unlearned cards', category: 'status' },
  { token: 'is:learning', label: 'Learning', description: 'Cards in learning stage', category: 'status' },
  { token: 'is:mature', label: 'Mature', description: 'Mastered cards (interval ≥ 21d)', category: 'status' },
  { token: 'is:leech', label: 'Leeches / Hard', description: 'Cards with 3+ lapses', category: 'status' },
  // Image
  { token: 'has:image', label: 'With Images', description: 'Cards with image attachments', category: 'image' },
  { token: 'has:noimage', label: 'Without Images', description: 'Cards without image attachments', category: 'image' },
  // Card Type
  { token: 'type:"Useful Expressions"', label: 'Useful Expressions', description: 'Expressions and phrases', category: 'type' },
  { token: 'type:Glossary', label: 'Glossary', description: 'Terminology and domain concepts', category: 'type' },
  { token: 'type:"Daily Words"', label: 'Daily Words', description: 'Daily vocabulary cards', category: 'type' },
  { token: 'type:"Ready Versions"', label: 'Ready Versions', description: 'Polished expression versions', category: 'type' },
  // Style
  { token: 'style:Formal', label: 'Formal', description: 'Formal register expressions', category: 'style' },
  { token: 'style:Informal', label: 'Informal', description: 'Casual / spoken expressions', category: 'style' },
  { token: 'style:General', label: 'General', description: 'General register expressions', category: 'style' }
]

/**
 * Returns dynamic suggestions based on what the user is typing at the end of the query.
 */
export function getSyntaxSuggestions(
  rawQuery: string,
  availableLabels: string[] = []
): SearchSyntaxSuggestion[] {
  if (!rawQuery) return []

  // Extract the last token being typed (word at cursor)
  const lastWordMatch = rawQuery.match(/(?:^|\s)([a-zA-Z0-9_:-]*(?:"[^"]*)?)$/)
  if (!lastWordMatch) return []
  const lastWord = lastWordMatch[1]
  if (!lastWord) return []

  const colonIndex = lastWord.indexOf(':')
  if (colonIndex === -1) {
    // If user typed 'is', 'has', 'tag', 'type', 'style' without colon yet, suggest prefix
    const lower = lastWord.toLowerCase()
    if ('is'.startsWith(lower)) {
      return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'status')
    }
    if ('has'.startsWith(lower)) {
      return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'image')
    }
    if ('type'.startsWith(lower)) {
      return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'type')
    }
    if ('style'.startsWith(lower)) {
      return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'style')
    }
    if ('tag'.startsWith(lower) || 'label'.startsWith(lower)) {
      return availableLabels.slice(0, 8).map(lbl => ({
        token: lbl.includes(' ') ? `tag:"${lbl}"` : `tag:${lbl}`,
        label: lbl,
        description: 'Filter by tag / domain',
        category: 'tag' as const
      }))
    }
    return []
  }

  const prefix = lastWord.slice(0, colonIndex).toLowerCase()
  const val = lastWord.slice(colonIndex + 1).replace(/^["']/, '').toLowerCase()

  if (prefix === 'is' || prefix === 'status') {
    return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'status' && (!val || s.token.toLowerCase().includes(val)))
  }

  if (prefix === 'has') {
    return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'image' && (!val || s.token.toLowerCase().includes(val)))
  }

  if (prefix === 'type') {
    return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'type' && (!val || s.token.toLowerCase().includes(val)))
  }

  if (prefix === 'style') {
    return BASE_SYNTAX_SUGGESTIONS.filter(s => s.category === 'style' && (!val || s.token.toLowerCase().includes(val)))
  }

  if (prefix === 'tag' || prefix === 'label') {
    return availableLabels
      .filter(lbl => !val || lbl.toLowerCase().includes(val))
      .slice(0, 10)
      .map(lbl => ({
        token: lbl.includes(' ') ? `tag:"${lbl}"` : `tag:${lbl}`,
        label: lbl,
        description: 'Filter by tag / domain',
        category: 'tag' as const
      }))
  }

  return []
}

/**
 * Extracts recognized and incomplete syntax tokens from rawQuery without modifying user input.
 */
export function extractSyntaxTokens(rawQuery: string): {
  matchedTokens: SyntaxTokenMatch[]
  parsedFilters: Partial<CardFilterState>
  incompleteToken?: string
} {
  const matchedTokens: SyntaxTokenMatch[] = []
  const parsedFilters: Partial<CardFilterState> = {}

  if (!rawQuery) {
    return { matchedTokens, parsedFilters }
  }

  const addMatch = (
    key: 'status' | 'type' | 'label' | 'style' | 'hasImage',
    rawMatch: string,
    start: number,
    end: number,
    value: any,
    isIncomplete = false
  ) => {
    matchedTokens.push({ key, rawMatch, start, end, value, isIncomplete })
    if (!isIncomplete && value !== undefined) {
      parsedFilters[key] = value
    }
  }

  // 1. Match is:xxx or status:xxx or has:xxx
  // Supports empty/partial values like is:, is:d, has:, has:image
  const isHasRegex = /\b(is|status|has):(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_-]*))/gi
  let m: RegExpExecArray | null
  while ((m = isHasRegex.exec(rawQuery)) !== null) {
    const op = m[1].toLowerCase()
    const val = (m[2] ?? m[3] ?? m[4] ?? '').toLowerCase()
    const isTrailing = m.index + m[0].length === rawQuery.length || /\s/.test(rawQuery.slice(m.index + m[0].length, m.index + m[0].length + 1))

    if (!val) {
      // Empty value e.g. "is:", "has:"
      addMatch(op === 'has' ? 'hasImage' : 'status', m[0], m.index, m.index + m[0].length, undefined, true)
      continue
    }

    let mappedStatus: CardFilterState['status'] | null = null
    let mappedImage: CardFilterState['hasImage'] | null = null

    if (op === 'is' || op === 'status') {
      if (val === 'due' || val === 'd' || val === 'du') mappedStatus = 'due'
      else if (val === 'new' || val === 'unlearned' || val === 'n') mappedStatus = 'new'
      else if (val === 'leech' || val === 'leeches' || val === 'difficult' || val === 'hard' || val === 'lee') mappedStatus = 'leech'
      else if (val === 'learning' || val === 'learn' || val === 'lea') mappedStatus = 'learning'
      else if (val === 'mature' || val === 'mastered' || val === 'mat' || val === 'mas') mappedStatus = 'mature'
      else if (val === 'image' || val === 'images' || val === 'picture' || val === 'pic') mappedImage = 'with_image'
      else if (val === 'noimage' || val === 'no-image' || val === 'no_image') mappedImage = 'without_image'
    } else if (op === 'has') {
      if (val === 'image' || val === 'images' || val === 'picture' || val === 'pic' || val === 'im') mappedImage = 'with_image'
      else if (val === 'noimage' || val === 'no-image' || val === 'no_image') mappedImage = 'without_image'
    }

    if (mappedStatus) {
      addMatch('status', m[0], m.index, m.index + m[0].length, mappedStatus)
    } else if (mappedImage) {
      addMatch('hasImage', m[0], m.index, m.index + m[0].length, mappedImage)
    } else if (isTrailing && (val.length <= 2 || m[0].endsWith(':'))) {
      // Unfinished typing e.g. "is:x" at end of query
      addMatch(op === 'has' ? 'hasImage' : 'status', m[0], m.index, m.index + m[0].length, undefined, true)
    }
  }

  // 2. Match tag:xxx or label:xxx (supports quotes, Chinese, nested taxonomy slashes)
  const tagRegex = /\b(tag|label):(?:"([^"]*)"|'([^']*)'|([^\s]*))/gi
  while ((m = tagRegex.exec(rawQuery)) !== null) {
    const labelVal = (m[2] ?? m[3] ?? m[4] ?? '').trim()
    if (!labelVal) {
      // Empty "tag:"
      addMatch('label', m[0], m.index, m.index + m[0].length, undefined, true)
    } else {
      addMatch('label', m[0], m.index, m.index + m[0].length, labelVal)
    }
  }

  // 3. Match type:xxx
  const typeRegex = /\btype:(?:"([^"]*)"|'([^']*)'|([^\s]*))/gi
  while ((m = typeRegex.exec(rawQuery)) !== null) {
    const rawType = (m[1] ?? m[2] ?? m[3] ?? '').toLowerCase()
    if (!rawType) {
      addMatch('type', m[0], m.index, m.index + m[0].length, undefined, true)
      continue
    }

    let mappedType: string | null = null
    if (rawType.includes('expression') || rawType === 'exp' || rawType === 'useful') mappedType = 'Useful Expressions'
    else if (rawType.includes('glossary') || rawType === 'glo') mappedType = 'Glossary'
    else if (rawType.includes('daily') || rawType === 'dai') mappedType = 'Daily Words'
    else if (rawType.includes('ready') || rawType === 'rea') mappedType = 'Ready Versions'

    if (mappedType) {
      addMatch('type', m[0], m.index, m.index + m[0].length, mappedType)
    } else if (rawType.length <= 3) {
      addMatch('type', m[0], m.index, m.index + m[0].length, undefined, true)
    }
  }

  // 4. Match style:xxx
  const styleRegex = /\bstyle:(?:"([^"]*)"|'([^']*)'|([^\s]*))/gi
  while ((m = styleRegex.exec(rawQuery)) !== null) {
    const rawStyle = (m[1] ?? m[2] ?? m[3] ?? '').toLowerCase()
    if (!rawStyle) {
      addMatch('style', m[0], m.index, m.index + m[0].length, undefined, true)
      continue
    }

    let mappedStyle: string | null = null
    if (rawStyle.startsWith('form') || rawStyle === 'for') mappedStyle = 'Formal'
    else if (rawStyle.startsWith('inform') || rawStyle === 'inf') mappedStyle = 'Informal'
    else if (rawStyle.startsWith('gen') || rawStyle === 'general') mappedStyle = 'General'

    if (mappedStyle) {
      addMatch('style', m[0], m.index, m.index + m[0].length, mappedStyle)
    } else if (rawStyle.length <= 3) {
      addMatch('style', m[0], m.index, m.index + m[0].length, undefined, true)
    }
  }

  const incompleteToken = matchedTokens.find(t => t.isIncomplete)?.rawMatch

  return { matchedTokens, parsedFilters, incompleteToken }
}

/**
 * Parses power search syntax e.g. "is:due tag:Tech style:Formal apple"
 * Non-destructively extracts filters and clean keyword query.
 * Preserves user spaces, trailing spaces, and multiple words cleanly.
 * Strips incomplete tokens from cleanQuery so cards do not vanish during typing.
 */
export function parseSearchSyntax(rawQuery: string): {
  cleanQuery: string
  parsedFilters: Partial<CardFilterState>
  incompleteToken?: string
} {
  if (!rawQuery) {
    return { cleanQuery: '', parsedFilters: {} }
  }

  const { matchedTokens, parsedFilters, incompleteToken } = extractSyntaxTokens(rawQuery)

  if (matchedTokens.length === 0) {
    return { cleanQuery: rawQuery, parsedFilters }
  }

  // Sort matched tokens ascending by start index
  const sortedTokens = [...matchedTokens].sort((a, b) => a.start - b.start)

  // Collect slices outside the matched token ranges
  const slices: string[] = []
  let lastIndex = 0

  for (const token of sortedTokens) {
    if (token.start > lastIndex) {
      slices.push(rawQuery.slice(lastIndex, token.start))
    }
    lastIndex = Math.max(lastIndex, token.end)
  }

  if (lastIndex < rawQuery.length) {
    slices.push(rawQuery.slice(lastIndex))
  }

  // Clean leading spaces left by stripped prefix tokens
  // Preserve trailing space if user is actively typing keywords
  const hasTrailingSpace = /\s$/.test(rawQuery)
  const remaining = slices.join(' ')

  if (!remaining.trim()) {
    return { cleanQuery: '', parsedFilters, incompleteToken }
  }

  const cleanQuery = remaining.trimStart().replace(/\s+/g, ' ').trimEnd() + (hasTrailingSpace ? ' ' : '')
  return { cleanQuery, parsedFilters, incompleteToken }
}

/**
 * Removes recognized syntax tokens from rawQuery without touching keyword search text.
 * Optionally limits removal to specific filter keys.
 */
export function removeSyntaxFromQuery(
  rawQuery: string,
  filterKeys?: Array<'status' | 'type' | 'label' | 'style' | 'hasImage'>
): string {
  if (!rawQuery) return ''
  const { matchedTokens } = extractSyntaxTokens(rawQuery)
  const tokensToRemove = filterKeys
    ? matchedTokens.filter(t => filterKeys.includes(t.key))
    : matchedTokens

  if (tokensToRemove.length === 0) return rawQuery

  // Sort descending by start index to delete from back to front without index shifting
  const sorted = [...tokensToRemove].sort((a, b) => b.start - a.start)
  let result = rawQuery
  for (const token of sorted) {
    result = result.slice(0, token.start) + result.slice(token.end)
  }

  if (!result.trim()) return ''

  const hasTrailingSpace = /\s$/.test(rawQuery)
  const cleaned = result.trimStart().replace(/\s+/g, ' ').trimEnd()
  return cleaned + (hasTrailingSpace ? ' ' : '')
}

/**
 * Resolves effective filters by combining structured UI filters with any inline power search syntax.
 * Inline query syntax takes precedence over default filters, while cleanQuery contains keyword text.
 */
export function getEffectiveFilters(filters: CardFilterState): CardFilterState & {
  cleanQuery: string
  incompleteToken?: string
} {
  const { cleanQuery, parsedFilters, incompleteToken } = parseSearchSyntax(filters.query || '')
  return {
    ...filters,
    ...(parsedFilters.status ? { status: parsedFilters.status } : {}),
    ...(parsedFilters.label ? { label: parsedFilters.label } : {}),
    ...(parsedFilters.type ? { type: parsedFilters.type } : {}),
    ...(parsedFilters.style ? { style: parsedFilters.style } : {}),
    ...(parsedFilters.hasImage ? { hasImage: parsedFilters.hasImage } : {}),
    cleanQuery,
    incompleteToken
  }
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
  const effective = getEffectiveFilters(filters)
  const query = (effective.cleanQuery || '').trim().toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)

  const filtered = cards.filter(card => {
    // 1. Type Filter
    if (effective.type !== 'All' && card.type !== effective.type) {
      return false
    }

    // 2. Status Filter
    if (effective.status !== 'all') {
      const isDue = isCardDue(card, now)
      const lapses = card.lapses || 0
      const reps = card.repetitions || 0
      const state = card.state ?? 0
      const interval = card.interval || 0

      if (effective.status === 'due' && !isDue) return false
      if (effective.status === 'leech' && lapses < 3) return false
      if (effective.status === 'new' && (reps > 0 || (state !== 0 && state !== undefined))) return false
      if (effective.status === 'learning' && state !== 1 && state !== 3) return false
      if (effective.status === 'mature' && interval < 21) return false
    }

    // 3. Label Filter
    if (effective.label !== 'All') {
      const cardLabel = (card.label || '').toLowerCase()
      const filterLabel = effective.label.toLowerCase()
      if (cardLabel !== filterLabel && !cardLabel.includes(filterLabel)) {
        return false
      }
    }

    // 4. Style Filter
    if (effective.style !== 'All') {
      if ((card.style || '') !== effective.style) {
        return false
      }
    }

    // 5. Image Attachment Filter
    if (effective.hasImage === 'with_image' && !card.imageUrl) return false
    if (effective.hasImage === 'without_image' && !!card.imageUrl) return false

    // 6. Time Range Filter
    if (effective.timeRange !== 'all') {
      if (!matchesTimeRange(card.createdAt, effective.timeRange, now)) {
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
    switch (effective.sortBy) {
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
