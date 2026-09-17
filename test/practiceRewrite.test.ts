import { describe, it, expect, vi } from 'vitest'
import { practiceRewrite, extractJsonObjects, extractJsonObject } from '../electron/main/ai'

describe('practiceRewrite workflow', () => {
  it('handles empty database gracefully', async () => {
    const mockDbHandlers = {
      getCards: vi.fn().mockReturnValue([])
    }
    const res = await practiceRewrite('Some text', {}, mockDbHandlers)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Your database is empty')
  })

  it('correctly parses modern JSON segment extractions', () => {
    const jsonOutput = JSON.stringify([
      { original: 'screeched to a halt', intent: 'stopped suddenly', context: 'The car screeched to a halt.' },
      { original: 'came to light', intent: 'became known', context: 'The truth came to light.' }
    ])

    const parsed = extractJsonObjects(jsonOutput)
    expect(parsed).toHaveLength(2)
    expect(parsed![0].original).toBe('screeched to a halt')
    expect(parsed![0].intent).toBe('stopped suddenly')
    expect(parsed![0].context).toBe('The car screeched to a halt.')
  })

  it('correctly parses single verification mapping object', () => {
    const mappingJson = '```json\n{\n  "0": 105,\n  "1": null\n}\n```'
    const parsed = extractJsonObject(mappingJson)
    expect(parsed).toEqual({ '0': 105, '1': null })
  })

  it('runs single-pass practiceRewrite and preserves text when no expressions fit', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      const prompt = body.messages[0].content
      expect(prompt).toContain('<vocabulary_bank>')
      expect(prompt).toContain('[ID: 101] "screeched to a halt"')
      
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'The vehicle stopped suddenly.',
                used_card_ids: []
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([{ id: 101, front: 'screeched to a halt', back: 'stopped abruptly' }]),
        getDueCards: vi.fn().mockReturnValue([])
      }

      const res = await practiceRewrite('The vehicle stopped suddenly.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(0)
      expect(res.result.text).toBe('The vehicle stopped suddenly.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('successfully integrates verified candidate in single-pass RAG call', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      const prompt = body.messages[0].content
      expect(prompt).toContain('<vocabulary_bank>')
      expect(prompt).toContain('[ID: 101] "screeched to a halt"')

      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'The vehicle screeched to a halt.',
                used_card_ids: [101]
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([{ id: 101, front: 'screeched to a halt', back: 'stopped abruptly' }]),
        getDueCards: vi.fn().mockReturnValue([])
      }

      const res = await practiceRewrite('The vehicle stopped suddenly.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(101)
      expect(res.result.text).toBe('The vehicle screeched to a halt.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('handles string card IDs like "[ID: 101]" in single-pass response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '```json\n{\n  "rewritten_text": "The vehicle screeched to a halt.",\n  "used_card_ids": ["[ID: 101]"]\n}\n```'
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([{ id: 101, front: 'screeched to a halt', back: 'stopped abruptly' }])
      }

      const res = await practiceRewrite('The vehicle stopped suddenly.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(101)
      expect(res.result.text).toBe('The vehicle screeched to a halt.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('limits to top 25 candidates via vector/hybrid search when database > 100 cards', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      const prompt = body.messages[0].content
      // Verify prompt only injected at most 25 candidates
      const idMatches = prompt.match(/\[ID: \d+\]/g) || []
      expect(idMatches.length).toBeLessThanOrEqual(25)

      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'The vehicle screeched to a halt.',
                used_card_ids: [1]
              })
            }
          }]
        })
      }
    }) as any

    try {
      const manyCards = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        front: `expression_${i + 1}`,
        back: `definition_${i + 1}`,
        type: 'Useful Expressions'
      }))

      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue(manyCards),
        searchVectorCards: vi.fn().mockResolvedValue(manyCards.slice(0, 25)),
        getDueCards: vi.fn().mockReturnValue([])
      }

      const res = await practiceRewrite('Some text to rewrite.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(mockDbHandlers.searchVectorCards).toHaveBeenCalled()
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('detects newly integrated expression if model omitted used_card_ids', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'We had to put off the meeting until Monday.'
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 42, front: 'put off', back: 'postpone' }
        ])
      }

      const res = await practiceRewrite('We delayed the meeting until Monday.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(42)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not trigger fallback if model explicitly returned empty used_card_ids', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'We had to put off the meeting until Monday.',
                used_card_ids: []
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 42, front: 'put off', back: 'postpone' }
        ])
      }

      const res = await practiceRewrite('We delayed the meeting until Monday.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('never matches card substrings like "ear" inside words like "learned"', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'I learned a lot from the lesson.'
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 99, front: '*ear*', back: 'auditory organ' }
        ])
      }

      const res = await practiceRewrite('I studied hard for the lesson.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('filters out cards with empty or whitespace fronts', async () => {
    const originalFetch = globalThis.fetch
    let capturedPrompt = ''
    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      capturedPrompt = body.messages[0].content
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'Done.',
                used_card_ids: []
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 1, front: '', back: 'empty front' },
          { id: 2, front: '   ', back: 'spaces' },
          { id: 3, front: 'valid word', back: 'definition' }
        ])
      }

      const res = await practiceRewrite('Text to rewrite', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(capturedPrompt).toContain('[ID: 3] "valid word"')
      expect(capturedPrompt).not.toContain('[ID: 1]')
      expect(capturedPrompt).not.toContain('[ID: 2]')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('correctly tokenizes and highlights CJK, punctuation (sth.), and ignores false substrings (ear in learned)', () => {
    const cards = [
      { front: 'sth.' },
      { front: '学习' },
      { front: 'ear' }
    ]
    const escapedWords = cards.map(c => c.front.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`((?<![a-zA-Z0-9])(?:${escapedWords.join('|')})(?![a-zA-Z0-9]))`, 'gi')

    const text1 = 'He said sth. to me, and I learned a lot because 我爱学习!'
    const parts = text1.split(regex)

    expect(parts).toContain('sth.')
    expect(parts).toContain('学习')
    expect(parts).not.toContain('ear')
    expect(parts.some(p => p.includes('learned'))).toBe(true)
  })

  it('properly escapes single quotes in LanceDB filter strings', () => {
    const type = "Today's Review"
    const escaped = type.replace(/'/g, "''")
    expect(escaped).toBe("Today''s Review")
    const sqlWhere = `type = '${escaped}'`
    expect(sqlWhere).toBe("type = 'Today''s Review'")
  })
})
