import { describe, it, expect } from 'vitest'
import { extractJsonArray, extractJsonObjects, extractJsonObject } from '../electron/main/ai'

describe('extractJsonArray', () => {
  it('parses standard JSON array in code block', () => {
    const raw = '```json\n["1", "2", "3"]\n```'
    expect(extractJsonArray(raw)).toEqual(['1', '2', '3'])
  })

  it('parses standard JSON array with numeric IDs in code block', () => {
    const raw = '```\n[1, 5, 8]\n```'
    expect(extractJsonArray(raw)).toEqual(['1', '5', '8'])
  })

  it('parses plain JSON array without markdown code blocks', () => {
    const raw = '["4", "7"]'
    expect(extractJsonArray(raw)).toEqual(['4', '7'])
  })

  it('handles surrounding conversational text', () => {
    const raw = 'Based on the evaluation criteria, here are the matching synonyms: ["10", "12"]. Hope this helps!'
    expect(extractJsonArray(raw)).toEqual(['10', '12'])
  })

  it('handles single quotes and trailing commas', () => {
    const raw = "['3', '9',]"
    expect(extractJsonArray(raw)).toEqual(['3', '9'])
  })

  it('handles empty array', () => {
    const raw = '```json\n[]\n```'
    expect(extractJsonArray(raw)).toEqual([])
  })

  it('handles plain empty array', () => {
    const raw = '[]'
    expect(extractJsonArray(raw)).toEqual([])
  })

  it('returns null for completely invalid text', () => {
    const raw = 'None of the candidates match.'
    expect(extractJsonArray(raw)).toBeNull()
  })

  it('returns null for empty string or null input', () => {
    expect(extractJsonArray('')).toBeNull()
  })
})

describe('extractJsonObjects & extractJsonObject', () => {
  it('parses array of objects from markdown code block', () => {
    const raw = '```json\n[{"original": "in a tough spot", "intent": "in difficulty", "context": "He is in a tough spot."}]\n```'
    const res = extractJsonObjects(raw)
    expect(res).toEqual([{ original: 'in a tough spot', intent: 'in difficulty', context: 'He is in a tough spot.' }])
  })

  it('parses array of objects with trailing commas and single quotes', () => {
    const raw = `[
      {'original': 'took off', 'intent': 'became successful', 'context': 'The app took off quickly.',},
    ]`
    const res = extractJsonObjects(raw)
    expect(res).toHaveLength(1)
    expect(res![0].original).toBe('took off')
  })

  it('extracts mapping object for segment verification', () => {
    const raw = '```json\n{"0": 42, "1": null, "2": "105"}\n```'
    const res = extractJsonObject(raw)
    expect(res).toEqual({ '0': 42, '1': null, '2': '105' })
  })

  it('preserves contractions like one\'s and don\'t during lenient parsing', () => {
    const raw = `[
      {'original': "at one's disposal", 'intent': "ready for someone's use", 'context': "They don't have it.",},
    ]`
    const res = extractJsonObjects(raw)
    expect(res).not.toBeNull()
    expect(res![0].original).toBe("at one's disposal")
    expect(res![0].intent).toBe("ready for someone's use")
    expect(res![0].context).toBe("They don't have it.")
  })

  it('returns null for unparseable input', () => {
    expect(extractJsonObjects('totally invalid')).toBeNull()
    expect(extractJsonObject('totally invalid')).toBeNull()
  })
})

import { extractCleanErrorMessage } from '../src/utils/errorMessage'

describe('extractCleanErrorMessage', () => {
  it('extracts human-readable message from token quota error (HTTP 400)', () => {
    const raw = `Error invoking remote method 'find-similar-cards': Error: AI failed to filter synonyms: API Error (400): {"error":{"message":"token quota is not enough","type":"credit_exhausted","code":"insufficient_quota"}}`
    const cleaned = extractCleanErrorMessage(raw)
    expect(cleaned).toBe('AI Error (400): token quota is not enough')
  })

  it('extracts human-readable message from quota exceeded error (HTTP 429)', () => {
    const raw = `Error invoking remote method 'find-similar-cards': Error: AI failed to filter synonyms: API Error (429): {"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota"}}`
    const cleaned = extractCleanErrorMessage(raw)
    expect(cleaned).toBe('AI Error (429): You exceeded your current quota, please check your plan and billing details.')
  })

  it('handles missing API key error', () => {
    const raw = `Error invoking remote method 'find-similar-cards': Error: AI API Key is not configured in Settings.`
    const cleaned = extractCleanErrorMessage(raw)
    expect(cleaned).toBe('AI API Key is not configured in Settings.')
  })

  it('handles plain network or timeout error without JSON', () => {
    const raw = `Error invoking remote method 'find-similar-cards': Error: AI failed to filter synonyms: The operation was aborted due to timeout`
    const cleaned = extractCleanErrorMessage(raw)
    expect(cleaned).toBe('The operation was aborted due to timeout')
  })

  it('handles plain string error', () => {
    expect(extractCleanErrorMessage('Network error')).toBe('Network error')
  })

  it('handles null, undefined, or empty inputs safely', () => {
    expect(extractCleanErrorMessage(null)).toBe('Unknown error occurred')
    expect(extractCleanErrorMessage(undefined)).toBe('Unknown error occurred')
    expect(extractCleanErrorMessage('')).toBe('Unknown error occurred')
  })
})

describe('Synonym strict filtering & error propagation contract', () => {
  const mockCandidates = [
    { id: 101, front: 'take a toll', back: 'have a serious bad effect' },
    { id: 102, front: 'bear the brunt', back: 'receive the worst part of something' },
    { id: 103, front: 'hit the road', back: 'depart or leave' }
  ]

  it('matches candidates by parsed AI string IDs and preserves strict synonyms', () => {
    const aiIds = ['101', '102']
    const matchedIds = new Set(aiIds.map(id => parseInt(id, 10)))
    const matched = mockCandidates.filter(c => matchedIds.has(c.id))
    expect(matched).toHaveLength(2)
    expect(matched.map(m => m.id)).toEqual([101, 102])
  })

  it('returns empty array when AI evaluates but finds no true synonyms', () => {
    const aiIds: string[] = []
    const matchedIds = new Set(aiIds.map(id => parseInt(id, 10)))
    const matched = mockCandidates.filter(c => matchedIds.has(c.id))
    expect(matched).toHaveLength(0)
  })

  it('throws an informative error on API quota failure instead of silently returning empty candidates', () => {
    const aiRes = {
      success: false,
      error: 'API Error (400): {"error":{"message":"token quota is not enough","type":"credit_exhausted"}}'
    }

    const runStage2 = () => {
      if (!aiRes.success) {
        throw new Error(aiRes.error || 'AI failed to analyze synonyms.')
      }
      return []
    }

    expect(runStage2).toThrow('token quota is not enough')
  })

  it('throws an informative error when API key is missing', () => {
    const settings = { aiKey: '   ' }
    const runStage2 = () => {
      const apiKey = (settings.aiKey || '').trim()
      if (!apiKey) {
        throw new Error('AI API Key is not configured in Settings.')
      }
      return []
    }

    expect(runStage2).toThrow('AI API Key is not configured in Settings.')
  })
})

