import { describe, it, expect, vi } from 'vitest'
import {
  practiceRewrite,
  extractJsonObjects,
  extractJsonObject,
  parseMarkedText,
  extractClauses,
  extractFtsStems,
  getCardTargetExpression,
  matchesCardExpression
} from '../electron/main/ai'

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

  it('limits candidates via multi-channel candidate retrieval when database > 60 cards', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      const prompt = body.messages[0].content
      // Verify prompt injected within candidates cap (50-60)
      const idMatches = prompt.match(/\[ID: \d+\]/g) || []
      expect(idMatches.length).toBeLessThanOrEqual(60)

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

  it('supplements cards used in rewritten_text even if model returned empty used_card_ids', async () => {
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
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(42)
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

  it('detects CJK 2-character expressions in fallback when used_card_ids is omitted', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: '在周末我喜欢学习新的技能。'
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 88, front: '学习', back: 'study / learn' }
        ])
      }

      const res = await practiceRewrite('在周末我喜欢做一些事情。', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(88)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('matches wildcards with spaces like "take * off" without double-space issues', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'Please take off your shoes at the entrance.'
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 55, front: 'take * off', back: 'remove clothes or shoes' }
        ])
      }

      const res = await practiceRewrite('Please remove your shoes.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(55)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('correctly matches card front containing digits like "24/7" rather than misinterpreting as card ID', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'The convenience store is open 24/7.',
                used_card_ids: ['24/7']
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 24, front: 'random card 24', back: 'something else' },
          { id: 77, front: '24/7', back: 'round the clock' }
        ])
      }

      const res = await practiceRewrite('The convenience store is always open.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(1)
      expect(res.result.cards[0].id).toBe(77)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('highlights cards with wildcards (*ear*, take * off) and multiline fronts (term_cn\\nterm_en)', () => {
    const highlightedCards = [
      { id: 1, front: '*ear*' },
      { id: 2, front: 'take * off' },
      { id: 3, front: '苹果\napple' },
      { id: 4, front: 'sth.' }
    ]

    type MatchTarget = { term: string; card: any }
    const targets: MatchTarget[] = []

    for (const card of highlightedCards) {
      if (!card || typeof card.front !== 'string') continue
      const lines = card.front.split(/\r?\n/)
      for (const line of lines) {
        const raw = line.trim()
        const clean = raw.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim()
        if (clean.length > 0) {
          targets.push({ term: clean, card })
        }
      }
    }

    targets.sort((a, b) => b.term.length - a.term.length)
    const escapedTerms = Array.from(new Set(targets.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
    const regex = new RegExp(`((?<![a-zA-Z0-9])(?:${escapedTerms.join('|')})(?![a-zA-Z0-9]))`, 'gi')

    const text = 'I learned to take off my coat, listened with an ear, ate an apple, and said sth. to you.'
    const parts = text.split(regex)

    expect(parts).toContain('take off')
    expect(parts).toContain('ear')
    expect(parts).toContain('apple')
    expect(parts).toContain('sth.')
    expect(parts).not.toContain('learned') // ear does not match inside learned!

    const earTarget = targets.find(t => t.term.toLowerCase() === 'ear')
    expect(earTarget?.card.id).toBe(1)

    const appleTarget = targets.find(t => t.term.toLowerCase() === 'apple')
    expect(appleTarget?.card.id).toBe(3)
  })

  it('supplements cards used in rewritten_text when AI only returned a partial ID list', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: "Let kids call the shots as if their desires are the be-all and end-all. First, be tuned in to their boundaries.",
                used_card_ids: [1] // AI only returned ID 1!
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDbHandlers = {
        getCards: vi.fn().mockReturnValue([
          { id: 1, front: 'call the shots', back: 'make decisions' },
          { id: 2, front: 'the be-all and end-all', back: 'most important thing' },
          { id: 400, front: 'be tuned in to sth.', back: 'be sensitive to' }
        ])
      }

      const res = await practiceRewrite('Let kids decide everything. First, listen to them.', { aiKey: 'test-key' }, mockDbHandlers)
      expect(res.success).toBe(true)
      expect(res.result.cards).toHaveLength(3)
      const ids = res.result.cards.map((c: any) => c.id)
      expect(ids).toContain(1)
      expect(ids).toContain(2)
      expect(ids).toContain(400)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  describe('Scheme A: AI-driven Ground Truth Tagging', () => {
    const candidates = [
      { id: 101, front: 'call the shots', back: 'make decisions' },
      { id: 102, front: 'double down on', back: 'commit more heavily' },
      { id: 103, front: 'be tuned in to sth.', back: 'be sensitive to' },
      { id: 104, front: 'sth.', back: 'something' }
    ]

    it('parseMarkedText accurately extracts single inline tag and produces clean text and segments', () => {
      const raw = 'The leadership decided to <mark id="102">double down on</mark> their renewable policy.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cleanText).toBe('The leadership decided to double down on their renewable policy.')
      expect(res.cards).toHaveLength(1)
      expect(res.cards[0].id).toBe(102)
      expect(res.segments).toHaveLength(3)
      expect(res.segments[0]).toEqual({ text: 'The leadership decided to ', card: null })
      expect(res.segments[1]).toEqual({ text: 'double down on', card: candidates[1] })
      expect(res.segments[2]).toEqual({ text: ' their renewable policy.', card: null })
    })

    it('parseMarkedText accurately handles inflected forms and detaches trailing punctuation', () => {
      const raw = 'They have <mark id="102">doubled down on,</mark> and successfully executed the plan.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cleanText).toBe('They have doubled down on, and successfully executed the plan.')
      expect(res.cards).toHaveLength(1)
      expect(res.cards[0].id).toBe(102)
      // The mark segment text should NOT contain the trailing comma!
      const markSeg = res.segments.find(s => s.card && s.card.id === 102)
      expect(markSeg?.text).toBe('doubled down on')
    })

    it('parseMarkedText handles multiple tags and deduplicates matched cards in order', () => {
      const raw = 'First, <mark id="101">call the shots</mark>. Later, <mark id="102">doubled down on</mark> the choices and <mark id="101">call the shots</mark> again.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cleanText).toBe('First, call the shots. Later, doubled down on the choices and call the shots again.')
      expect(res.cards).toHaveLength(2)
      expect(res.cards[0].id).toBe(101)
      expect(res.cards[1].id).toBe(102)
    })

    it('parseMarkedText handles diverse id attribute formats (quotes, unquoted, prefix)', () => {
      const raw1 = 'Test <mark id=\'101\'>calling the shots</mark> single quote.'
      const raw2 = 'Test <mark id=102>doubling down on</mark> unquoted.'
      const raw3 = 'Test <mark id="[ID: 103]">tuned in to</mark> bracketed.'

      expect(parseMarkedText(raw1, candidates).cards[0].id).toBe(101)
      expect(parseMarkedText(raw2, candidates).cards[0].id).toBe(102)
      expect(parseMarkedText(raw3, candidates).cards[0].id).toBe(103)
    })

    it('parseMarkedText returns empty segments and clean text when model omits tags', () => {
      const raw = 'Plain text without any tags.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cleanText).toBe('Plain text without any tags.')
      expect(res.cards).toHaveLength(0)
      expect(res.segments).toHaveLength(0)
    })

    it('Issue #13: practiceRewrite with Scheme A does NOT mark "double down on" when standalone "double" is used', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  rewritten_text: 'We enjoyed a double espresso while discussing business.',
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
            { id: 501, front: 'double down on', back: 'commit heavily' }
          ]),
          getDueCards: vi.fn().mockReturnValue([])
        }

        const res = await practiceRewrite('We had two espressos.', { aiKey: 'test-key' }, mockDbHandlers)
        expect(res.success).toBe(true)
        // Card 501 ("double down on") MUST NOT be falsely marked!
        expect(res.result.cards).toHaveLength(0)
        expect(res.result.text).toBe('We enjoyed a double espresso while discussing business.')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('Issue #13: practiceRewrite with Scheme A DOES mark "double down on" when AI tags inflected phrase', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  rewritten_text: 'The government decided to <mark id="501">double down on</mark> renewable subsidies.',
                  used_card_ids: [501]
                })
              }
            }]
          })
        }
      }) as any

      try {
        const mockDbHandlers = {
          getCards: vi.fn().mockReturnValue([
            { id: 501, front: 'double down on', back: 'commit heavily' }
          ]),
          getDueCards: vi.fn().mockReturnValue([])
        }

        const res = await practiceRewrite('The government committed more to subsidies.', { aiKey: 'test-key' }, mockDbHandlers)
        expect(res.success).toBe(true)
        expect(res.result.cards).toHaveLength(1)
        expect(res.result.cards[0].id).toBe(501)
        expect(res.result.text).toBe('The government decided to double down on renewable subsidies.')
        expect(res.result.segments).toBeDefined()
        const markedSeg = res.result.segments.find((s: any) => s.card?.id === 501)
        expect(markedSeg).toBeDefined()
        expect(markedSeg.text).toBe('double down on')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('Scheme A: practiceRewrite does NOT scan entire library, preventing unintended matches from large database', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  rewritten_text: 'They will double the production next quarter.',
                  used_card_ids: []
                })
              }
            }]
          })
        }
      }) as any

      try {
        // Library has > 100 cards, including card 999 ("double") that was NOT in candidateCards
        const allCards = Array.from({ length: 150 }, (_, i) => ({
          id: i + 1,
          front: `phrase_${i + 1}`,
          back: `def_${i + 1}`
        }))
        // An unprompted library card that happens to match text
        allCards.push({ id: 999, front: 'double', back: 'twice as much' })

        const mockDbHandlers = {
          getCards: vi.fn().mockReturnValue(allCards),
          searchVectorCards: vi.fn().mockResolvedValue(allCards.slice(0, 25)),
          getDueCards: vi.fn().mockReturnValue([])
        }

        const res = await practiceRewrite('They will increase production.', { aiKey: 'test-key' }, mockDbHandlers)
        expect(res.success).toBe(true)
        // Library card 999 ("double") was NOT in candidateCards, so it should NOT be matched!
        expect(res.result.cards.some((c: any) => c.id === 999)).toBe(false)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('Scenario 1: does not hijack card front containing numbers when card ID with that number exists', () => {
      const candidates = [
        { id: 22, front: 'call the shots', back: 'make decisions' },
        { id: 50, front: 'catch-22', back: 'dilemma' }
      ]
      const raw = 'It is a classic <mark id="catch-22">catch-22</mark> situation.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cards).toHaveLength(1)
      expect(res.cards[0].id).toBe(50)
      expect(res.cards[0].front).toBe('catch-22')
    })

    it('Scenario 2: prioritizes longer multi-word match over short sub-word in fallback matching', () => {
      const candidates = [
        { id: 1, front: 'turn', back: 'rotate' },
        { id: 2, front: 'turn a blind eye to', back: 'ignore' }
      ]
      const raw = 'The officials <mark id="turn a blind eye">turned a blind eye to</mark> the infractions.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cards).toHaveLength(1)
      expect(res.cards[0].id).toBe(2)
      expect(res.cards[0].front).toBe('turn a blind eye to')
    })

    it('Scenario 3: practiceRewrite segments declared used_card_ids even if model omitted inline tag for one card', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  rewritten_text: 'The committee will <mark id="101">call the shots</mark> and double down on their climate goals.',
                  used_card_ids: [101, 102]
                })
              }
            }]
          })
        }
      }) as any

      try {
        const mockDbHandlers = {
          getCards: vi.fn().mockReturnValue([
            { id: 101, front: 'call the shots', back: 'make decisions' },
            { id: 102, front: 'double down on', back: 'commit heavily' }
          ]),
          getDueCards: vi.fn().mockReturnValue([])
        }

        const res = await practiceRewrite('The committee will lead and commit more.', { aiKey: 'test-key' }, mockDbHandlers)
        expect(res.success).toBe(true)
        expect(res.result.cards).toHaveLength(2)
        // Both card 101 AND card 102 must have corresponding segments in result.segments!
        const segCards = res.result.segments.filter((s: any) => s.card).map((s: any) => s.card.id)
        expect(segCards).toContain(101)
        expect(segCards).toContain(102)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('Scenario 4: detaches sentence-ending period even if card front ends with sth. abbreviation', () => {
      const candidates = [
        { id: 103, front: 'be tuned in to sth.', back: 'sensitive to' }
      ]
      const raw = 'They were <mark id="103">tuned in to the latest frequency.</mark>'
      const res = parseMarkedText(raw, candidates)

      expect(res.cards).toHaveLength(1)
      const markSeg = res.segments.find(s => s.card && s.card.id === 103)
      expect(markSeg?.text).toBe('tuned in to the latest frequency')
      const trailingSeg = res.segments[res.segments.length - 1]
      expect(trailingSeg.text).toBe('.')
      expect(trailingSeg.card).toBeNull()
    })

    it('Scenario 5: trims internal whitespace and handles quotes inside mark tag cleanly', () => {
      const candidates = [
        { id: 101, front: 'call the shots', back: 'make decisions' }
      ]
      const raw = 'The executives will <mark id="101"> "call the shots." </mark>'
      const res = parseMarkedText(raw, candidates)

      expect(res.cards).toHaveLength(1)
      const markSeg = res.segments.find(s => s.card && s.card.id === 101)
      expect(markSeg?.text).toBe('call the shots')
      expect(res.cleanText).toBe('The executives will "call the shots."')
    })

    it('Scenario 6: strips internal HTML tags from mark segment text', () => {
      const candidates = [
        { id: 101, front: 'call the shots', back: 'make decisions' }
      ]
      const raw = 'The executives will <mark id="101">call <b>the shots</b></mark> today.'
      const res = parseMarkedText(raw, candidates)

      expect(res.cards).toHaveLength(1)
      const markSeg = res.segments.find(s => s.card && s.card.id === 101)
      expect(markSeg?.text).toBe('call the shots')
      expect(res.cleanText).toBe('The executives will call the shots today.')
    })
  })

  describe('Multi-channel retrieval and cross-type candidate expansion', () => {
    describe('extractClauses', () => {
      it('returns empty array for empty or whitespace text', () => {
        expect(extractClauses('')).toEqual([])
        expect(extractClauses('   \n  ')).toEqual([])
      })

      it('preserves short sentence as single clause', () => {
        const clauses = extractClauses('He ran away.')
        expect(clauses).toHaveLength(1)
        expect(clauses[0]).toBe('He ran away')
      })

      it('chunks long text into 4~15 word clauses along punctuation and conjunction boundaries', () => {
        const longText = 'The British government recently enacted ambitious air quality regulations, requiring local authorities to impose hefty penalties on non-compliant vehicles, while environmental advocates argued that financial fines alone cannot solve the root problem.'
        const clauses = extractClauses(longText)
        expect(clauses.length).toBeGreaterThanOrEqual(3)
        for (const clause of clauses) {
          const wordCount = clause.split(/\s+/).filter(Boolean).length
          expect(wordCount).toBeGreaterThanOrEqual(4)
          expect(wordCount).toBeLessThanOrEqual(16)
        }
      })

      it('merges short introductory phrases (< 4 words) so no orphaned sub-4-word fragments exist', () => {
        const text = 'In fact, the government decides to implement strict measures across the nation to combat the rising pollution levels in cities.'
        const clauses = extractClauses(text)
        expect(clauses.length).toBeGreaterThanOrEqual(1)
        for (const clause of clauses) {
          const wordCount = clause.split(/\s+/).filter(Boolean).length
          expect(wordCount).toBeGreaterThanOrEqual(4)
        }
        expect(clauses[0]).toContain('In fact')
      })

      it('preserves decimal numbers and acronyms without shattering sentences into nonsense fragments', () => {
        const text = 'The U.K. government enacted a £12.50 daily clean air charge. Local authorities welcomed the measure.'
        const clauses = extractClauses(text)
        expect(clauses.length).toBe(2)
        expect(clauses[0]).toContain('£12.50')
        expect(clauses[0]).toContain('U.K.')
        expect(clauses[1]).toContain('Local authorities')
      })
    })

    describe('extractFtsStems', () => {
      it('filters common stop words and returns empty array when only stop words given', () => {
        expect(extractFtsStems('the and or but in on at to for')).toEqual([])
        expect(extractFtsStems('')).toEqual([])
      })

      it('correctly stems English inflections (-s, -es, -ed, -ing, -ies)', () => {
        const text = 'The government stipulates strict fines for polluting while enacting new policies.'
        const stems = extractFtsStems(text)
        expect(stems).toContain('stipulate')
        expect(stems).toContain('fine')
        expect(stems).toContain('pollute')
        expect(stems).toContain('enact')
        expect(stems).toContain('policy')
        expect(stems).not.toContain('the')
        expect(stems).not.toContain('for')
        expect(stems).not.toContain('while')
      })

      it('stems double-vowel and diphthong words without incorrectly appending "e" (clean, read, speak, wait)', () => {
        const text = 'They cleaned the room after reading and speaking with waited candidates while maintaining standards.'
        const stems = extractFtsStems(text)
        expect(stems).toContain('clean')
        expect(stems).not.toContain('cleane')
        expect(stems).toContain('read')
        expect(stems).not.toContain('reade')
        expect(stems).toContain('speak')
        expect(stems).not.toContain('speake')
        expect(stems).toContain('wait')
        expect(stems).not.toContain('waite')
        expect(stems).toContain('maintain')
        expect(stems).not.toContain('maintaine')
      })

      it('extracts CJK tokens for multilingual and Glossary cards', () => {
        const text = '研讨会重点研究了 跨大西洋奴隶贸易 与 行李袋 的历史背景。'
        const stems = extractFtsStems(text)
        expect(stems).toContain('跨大西洋奴隶贸易')
        expect(stems).toContain('行李袋')
      })
    })

    describe('getCardTargetExpression', () => {
      it('extracts English front and Chinese back for Useful Expressions', () => {
        const card = { id: 1, front: 'stipulate', back: '规定，明确要求', type: 'Useful Expressions' }
        const res = getCardTargetExpression(card)
        expect(res.term).toBe('stipulate')
        expect(res.context).toBe('规定，明确要求')
      })

      it('extracts English back and Chinese front for Daily Words', () => {
        const card = { id: 2, front: '行李袋', back: 'duffle bag / holdall', type: 'Daily Words' }
        const res = getCardTargetExpression(card)
        expect(res.term).toBe('duffle bag / holdall')
        expect(res.context).toBe('行李袋')
      })

      it('extracts English second line from front for Glossary cards', () => {
        const card = {
          id: 3,
          front: '跨大西洋奴隶贸易\ntransatlantic slavery',
          back: '历史学术术语',
          type: 'Glossary'
        }
        const res = getCardTargetExpression(card)
        expect(res.term).toBe('transatlantic slavery')
        expect(res.context).toBe('跨大西洋奴隶贸易 — 历史学术术语')
      })

      it('handles single-line Glossary front safely', () => {
        const card = { id: 4, front: 'carbon credit', back: '碳信用', type: 'Glossary' }
        const res = getCardTargetExpression(card)
        expect(res.term).toBe('carbon credit')
        expect(res.context).toBe('碳信用')
      })

      it('extracts English term from back if Glossary front has only Chinese', () => {
        const card = { id: 5, front: '碳排放交易系统', back: 'emissions trading system', type: 'Glossary' }
        const res = getCardTargetExpression(card)
        expect(res.term).toBe('emissions trading system')
        expect(res.context).toBe('碳排放交易系统')
      })

      it('handles null and empty cards gracefully', () => {
        expect(getCardTargetExpression(null)).toEqual({ term: '', context: '' })
        expect(getCardTargetExpression({ front: '', back: '' })).toEqual({ term: '', context: '' })
      })
    })

    describe('matchesCardExpression', () => {
      it('matches individual slash-separated expression from Daily Words back', () => {
        const card = { id: 201, front: '行李袋', back: 'duffle bag / holdall', type: 'Daily Words' }
        expect(matchesCardExpression(card, 'duffle bag')).toBe(true)
        expect(matchesCardExpression(card, 'holdall')).toBe(true)
        expect(matchesCardExpression(card, '行李袋')).toBe(true)
        expect(matchesCardExpression(card, 'backpack')).toBe(false)
      })

      it('matches individual English line from Glossary front', () => {
        const card = {
          id: 301,
          front: '跨大西洋奴隶贸易\ntransatlantic slavery',
          back: '历史学专有名词',
          type: 'Glossary'
        }
        expect(matchesCardExpression(card, 'transatlantic slavery')).toBe(true)
        expect(matchesCardExpression(card, '跨大西洋奴隶贸易')).toBe(true)
        expect(matchesCardExpression(card, 'slave trade')).toBe(false)
      })
    })

    describe('Multi-channel candidate retrieval execution', () => {
      it('executes parallel Channels A (SRS), B (FTS), and C (Vector) and harmonizes within cap (<= 60)', async () => {
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
                    rewritten_text: 'The authority will stipulate strict rules.',
                    used_card_ids: [480]
                  })
                }
              }]
            })
          }
        }) as any

        try {
          // Total > 60 cards
          const allCards = Array.from({ length: 80 }, (_, i) => ({
            id: i + 1,
            front: `phrase_${i + 1}`,
            back: `def_${i + 1}`,
            type: 'Useful Expressions'
          }))
          allCards.push({ id: 480, front: 'stipulate', back: '规定', type: 'Useful Expressions' })
          allCards.push({ id: 999, front: 'Ready Sentence', back: 'Je suis pret.', type: 'Ready Versions' })

          const nowIso = new Date().toISOString()
          const mockDbHandlers = {
            getCards: vi.fn().mockReturnValue(allCards),
            getDueCards: vi.fn().mockReturnValue([
              { id: 10, front: 'due_card_1', back: 'def', type: 'Useful Expressions', lapses: 3, nextReviewDate: nowIso },
              { id: 11, front: 'due_card_2', back: 'def', type: 'Useful Expressions', lapses: 1, nextReviewDate: nowIso }
            ]),
            searchCards: vi.fn().mockReturnValue([
              { id: 480, front: 'stipulate', back: '规定', type: 'Useful Expressions' }
            ]),
            searchVectorCards: vi.fn().mockResolvedValue([
              { id: 20, front: 'vector_hit_1', back: 'def', type: 'Useful Expressions' },
              { id: 21, front: 'vector_hit_2', back: 'def', type: 'Useful Expressions' }
            ])
          }

          const res = await practiceRewrite(
            'The government stipulates strict regulations on pollution.',
            { aiKey: 'test-key' },
            mockDbHandlers
          )

          expect(res.success).toBe(true)
          expect(mockDbHandlers.getDueCards).toHaveBeenCalled()
          expect(mockDbHandlers.searchCards).toHaveBeenCalled()
          expect(mockDbHandlers.searchVectorCards).toHaveBeenCalled()

          // Ready Versions must be excluded
          expect(capturedPrompt).not.toContain('[ID: 999]')
          // FTS match must be included
          expect(capturedPrompt).toContain('[ID: 480] "stipulate"')
          // SRS due card must be included
          expect(capturedPrompt).toContain('[ID: 10]')
          // Vector hit must be included
          expect(capturedPrompt).toContain('[ID: 20]')

          const idMatches = capturedPrompt.match(/\[ID: \d+\]/g) || []
          expect(idMatches.length).toBeLessThanOrEqual(60)
        } finally {
          globalThis.fetch = originalFetch
        }
      })
    })

    describe('Daily Words and Glossary single-pass integration', () => {
      it('integrates Daily Words when target expression is in card.back and model uses inline mark tag', async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn().mockImplementation(async () => {
          return {
            ok: true,
            json: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify({
                    rewritten_text: 'I packed my clothes into a <mark id="201">duffle bag</mark> for the trip.',
                    used_card_ids: [201]
                  })
                }
              }]
            })
          }
        }) as any

        try {
          const mockDbHandlers = {
            getCards: vi.fn().mockReturnValue([
              { id: 201, front: '行李袋', back: 'duffle bag / holdall', type: 'Daily Words' }
            ])
          }

          const res = await practiceRewrite(
            'I packed my clothes into a large travel bag for the trip.',
            { aiKey: 'test-key' },
            mockDbHandlers
          )

          expect(res.success).toBe(true)
          expect(res.result.cards).toHaveLength(1)
          expect(res.result.cards[0].id).toBe(201)
          expect(res.result.text).toBe('I packed my clothes into a duffle bag for the trip.')
          const matchedSeg = res.result.segments.find((s: any) => s.card && s.card.id === 201)
          expect(matchedSeg?.text).toBe('duffle bag')
        } finally {
          globalThis.fetch = originalFetch
        }
      })

      it('falls back to regex matching for Daily Words even if model drops mark tag', async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn().mockImplementation(async () => {
          return {
            ok: true,
            json: async () => ({
              choices: [{
                message: {
                  content: JSON.stringify({
                    rewritten_text: 'I packed my clothes into a duffle bag for the trip.',
                    used_card_ids: [201]
                  })
                }
              }]
            })
          }
        }) as any

        try {
          const mockDbHandlers = {
            getCards: vi.fn().mockReturnValue([
              { id: 201, front: '行李袋', back: 'duffle bag / holdall', type: 'Daily Words' }
            ])
          }

          const res = await practiceRewrite(
            'I packed my clothes into a large travel bag for the trip.',
            { aiKey: 'test-key' },
            mockDbHandlers
          )

          expect(res.success).toBe(true)
          expect(res.result.cards).toHaveLength(1)
          expect(res.result.cards[0].id).toBe(201)
          expect(res.result.text).toBe('I packed my clothes into a duffle bag for the trip.')
          const matchedSeg = res.result.segments.find((s: any) => s.card && s.card.id === 201)
          expect(matchedSeg?.text).toBe('duffle bag')
        } finally {
          globalThis.fetch = originalFetch
        }
      })

      it('integrates Glossary card with multiline front in single-pass practice rewrite', async () => {
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
                    rewritten_text: 'The exhibition examined the brutal history of <mark id="301">transatlantic slavery</mark>.',
                    used_card_ids: [301]
                  })
                }
              }]
            })
          }
        }) as any

        try {
          const mockDbHandlers = {
            getCards: vi.fn().mockReturnValue([
              {
                id: 301,
                front: '跨大西洋奴隶贸易\ntransatlantic slavery',
                back: '历史学专有名词',
                type: 'Glossary'
              }
            ])
          }

          const res = await practiceRewrite(
            'The exhibition examined the brutal history of slave trade across the Atlantic.',
            { aiKey: 'test-key' },
            mockDbHandlers
          )

          expect(res.success).toBe(true)
          expect(capturedPrompt).toContain('[ID: 301] "transatlantic slavery"')
          expect(res.result.cards).toHaveLength(1)
          expect(res.result.cards[0].id).toBe(301)
          expect(res.result.text).toBe('The exhibition examined the brutal history of transatlantic slavery.')
          const matchedSeg = res.result.segments.find((s: any) => s.card && s.card.id === 301)
          expect(matchedSeg?.text).toBe('transatlantic slavery')
        } finally {
          globalThis.fetch = originalFetch
        }
      })

      it('strictly excludes Ready Versions cards from candidate pool and Prompt', async () => {
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
                    rewritten_text: 'Original text kept.',
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
              { id: 401, front: 'This is a complete ready version paragraph.', back: '完整译文段落', type: 'Ready Versions' },
              { id: 101, front: 'screeched to a halt', back: 'stopped suddenly', type: 'Useful Expressions' }
            ])
          }

          const res = await practiceRewrite('Some text', { aiKey: 'test-key' }, mockDbHandlers)
          expect(res.success).toBe(true)
          expect(capturedPrompt).not.toContain('[ID: 401]')
          expect(capturedPrompt).toContain('[ID: 101]')
        } finally {
          globalThis.fetch = originalFetch
        }
      })
    })
  })
})



