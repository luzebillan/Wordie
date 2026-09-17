import { describe, it, expect } from 'vitest'
import { cosineSimilarity, getEmbedding, getEmbeddingsBatch } from '../electron/main/semantic'

describe('semantic module', () => {
  it('calculates cosineSimilarity accurately', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0)
    expect(cosineSimilarity([], [1, 0])).toBe(0)
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0)
  })

  it('handles empty or blank texts in getEmbedding and getEmbeddingsBatch', async () => {
    expect(await getEmbedding('')).toEqual([])
    expect(await getEmbedding('   ')).toEqual([])
    expect(await getEmbeddingsBatch([])).toEqual([])
  })

  it('generates 384-dimensional normalized vectors via local multilingual MiniLM', async () => {
    const singleVec = await getEmbedding('hello world')
    expect(singleVec).toHaveLength(384)

    // Verify L2 normalization (dot product with itself should be approx 1.0)
    const norm = Math.sqrt(singleVec.reduce((sum, v) => sum + v * v, 0))
    expect(norm).toBeCloseTo(1.0, 3)

    // Batch embedding
    const batch = await getEmbeddingsBatch(['apple', '自然语言处理', ''])
    expect(batch).toHaveLength(3)
    expect(batch[0]).toHaveLength(384)
    expect(batch[1]).toHaveLength(384)
    expect(batch[2]).toEqual([]) // blank text should result in empty vector
  })
})
