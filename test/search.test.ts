import { describe, it, expect } from 'vitest'

// Pure ranking/matching logic tester matching the implementation in searchService & Library
function rankCards(query: string, cards: any[], limit?: number) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return limit ? cards.slice(0, limit) : cards

  const tokens = trimmed.split(/\s+/).filter(Boolean)

  const matched = cards.filter(card => {
    const front = (card.front || '').toLowerCase()
    const back = (card.back || '').toLowerCase()
    const label = (card.label || '').toLowerCase()
    const style = (card.style || '').toLowerCase()
    const context = (card.sourceContext || '').toLowerCase()

    if (
      front.includes(trimmed) ||
      back.includes(trimmed) ||
      label.includes(trimmed) ||
      style.includes(trimmed) ||
      context.includes(trimmed)
    ) {
      return true
    }

    if (tokens.length > 1) {
      return tokens.every(token =>
        front.includes(token) ||
        back.includes(token) ||
        label.includes(token) ||
        style.includes(token) ||
        context.includes(token)
      )
    }

    return false
  })

  const scored = matched.map(card => {
    let score = 0
    const front = (card.front || '').toLowerCase()
    const back = (card.back || '').toLowerCase()
    const label = (card.label || '').toLowerCase()
    const style = (card.style || '').toLowerCase()
    const context = (card.sourceContext || '').toLowerCase()

    if (front === trimmed) score += 1000
    else if (front.startsWith(trimmed)) score += 500
    else if (front.includes(trimmed)) score += 250

    if (label === trimmed || style === trimmed) score += 150
    else if (label.includes(trimmed) || style.includes(trimmed)) score += 80

    if (back.includes(trimmed)) score += 60
    if (context.includes(trimmed)) score += 30

    let frontTokensHit = 0
    let backTokensHit = 0
    for (const t of tokens) {
      if (front.includes(t)) frontTokensHit++
      if (back.includes(t)) backTokensHit++
    }
    score += frontTokensHit * 40
    score += backTokensHit * 15

    return { card, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const results = scored.map(s => s.card)
  return limit && limit > 0 ? results.slice(0, limit) : results
}

describe('Search Matching & Relevance Ranking Engine', () => {
  const sampleCards = [
    { id: 1, front: 'apple', back: 'A round fruit with red or green skin', label: 'Food', style: 'General' },
    { id: 2, front: 'apple pie', back: 'A pastry filled with baked apples', label: 'Dessert', style: 'Informal' },
    { id: 3, front: 'pine apple', back: 'Tropical fruit with spiky skin', label: 'Food', style: 'General' },
    { id: 4, front: 'take off', back: 'To remove something, or when a plane departs', label: 'Idiom', style: 'Informal' },
    { id: 5, front: 'take it easy', back: 'To relax and not worry', label: 'Idiom', style: 'Informal' },
    { id: 6, front: '人工智能', back: 'Artificial Intelligence and machine learning', label: 'Tech', style: 'Formal' },
    { id: 7, front: '自然语言处理', back: 'NLP, a subfield of 人工智能', label: 'Tech', style: 'Formal' },
    { id: 8, front: 'cardiology', back: 'Medical branch dealing with heart disorders', label: 'Medical', style: 'Formal' },
  ]

  it('Exact front match has highest priority', () => {
    const results = rankCards('apple', sampleCards)
    expect(results.length).toBeGreaterThanOrEqual(3)
    expect(results[0].id).toBe(1) // 'apple' exact match is first
    expect(results[1].id).toBe(2) // 'apple pie' startsWith is second
  })

  it('Matches Chinese/CJK middle-substring accurately', () => {
    const results = rankCards('语言', sampleCards)
    expect(results.length).toBe(1)
    expect(results[0].front).toBe('自然语言处理')
  })

  it('Matches Chinese phrase in both front and back fields', () => {
    const results = rankCards('人工智能', sampleCards)
    expect(results.length).toBe(2)
    // ID 6 has exact front '人工智能', ID 7 has it in back definition
    expect(results[0].id).toBe(6)
    expect(results[1].id).toBe(7)
  })

  it('Searches label and style fields correctly', () => {
    const resultsByLabel = rankCards('Medical', sampleCards)
    expect(resultsByLabel.length).toBe(1)
    expect(resultsByLabel[0].front).toBe('cardiology')

    const resultsByStyle = rankCards('Formal', sampleCards)
    // 'Formal' is also a substring of 'Informal' (cards 2,4,5), so 6 cards match, but exact 'Formal' (6,7,8) rank first
    expect(resultsByStyle.length).toBe(6)
    expect(resultsByStyle.slice(0, 3).map(c => c.id).sort()).toEqual([6, 7, 8])
  })

  it('Supports multi-token search across fields', () => {
    const results = rankCards('apple pastry', sampleCards)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(2) // 'apple pie' contains 'apple' in front and 'pastry' in back
  })

  it('Applies limit correctly when specified', () => {
    const resultsWithLimit = rankCards('Food', sampleCards, 1)
    expect(resultsWithLimit).toHaveLength(1)

    const resultsWithoutLimit = rankCards('Food', sampleCards)
    expect(resultsWithoutLimit).toHaveLength(2)
  })
})
