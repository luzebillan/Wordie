import { describe, it, expect } from 'vitest'
import { extractJsonArray } from '../electron/main/ai'

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
