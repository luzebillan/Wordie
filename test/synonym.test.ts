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
