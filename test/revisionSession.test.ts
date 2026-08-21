import { describe, it, expect } from 'vitest'
import {
  initSessionQueue,
  computeSessionStats,
  applyReviewToQueue,
  applyUndoToQueue,
  applySkipToQueue,
  applyShuffleToQueue,
  syncCardTextInQueue
} from '../src/utils/revisionSession'

describe('Revision Session State Machine', () => {
  const dummyCards = [
    { id: 1, front: 'Card 1 Front', back: 'Card 1 Back', type: 'Useful Expressions' },
    { id: 2, front: 'Card 2 Front', back: 'Card 2 Back', type: 'Glossary' },
    { id: 3, front: 'Card 3 Front', back: 'Card 3 Back', type: 'Daily Words' }
  ]

  it('TC-01: Initializes session queue and status map accurately', () => {
    const { queue, statusMap } = initSessionQueue(dummyCards)
    expect(queue).toHaveLength(3)
    expect(queue[0].id).toBe(1)
    expect(queue[0]._sessionKey).toBeDefined()
    expect(queue[1]._sessionKey).toBeDefined()
    expect(queue[2]._sessionKey).toBeDefined()
    expect(queue[0]._sessionKey).not.toBe(queue[1]._sessionKey)

    const stats = computeSessionStats(statusMap)
    expect(stats.toReview).toBe(3)
    expect(stats.forgotten).toBe(0)
    expect(stats.memorized).toBe(0)
  })

  it('TC-02: Forgetting the last card generates a unique _sessionKey and advances cleanly', () => {
    // Session with 1 card
    const singleCardList = [{ id: 99, front: 'Last Card', back: 'Back', type: 'Daily Words' }]
    const { queue, statusMap } = initSessionQueue(singleCardList)
    expect(queue).toHaveLength(1)
    const initialKey = queue[0]._sessionKey

    // Click Forget on the last (and only) card at index 0
    const res = applyReviewToQueue(queue, 0, false, statusMap)

    expect(res.nextQueue).toHaveLength(2)
    expect(res.nextIndex).toBe(1)
    expect(res.nextStatusMap.get(99)).toBe('secondReview')

    const nextCard = res.nextQueue[res.nextIndex]
    expect(nextCard.id).toBe(99)
    // CRITICAL: Next card MUST have a different _sessionKey so React useEffect triggers reset
    expect(nextCard._sessionKey).not.toBe(initialKey)

    const stats = computeSessionStats(res.nextStatusMap)
    expect(stats.toReview).toBe(0)
    expect(stats.forgotten).toBe(1)
    expect(stats.memorized).toBe(0)
  })

  it('TC-03: Repeatedly forgetting the same card (5 times) advances cleanly with fresh keys every time', () => {
    let { queue, statusMap } = initSessionQueue([{ id: 1, front: 'F', back: 'B', type: 'Daily Words' }])
    let currentIndex = 0
    const seenKeys = new Set<string>()

    for (let step = 0; step < 5; step++) {
      const activeCard = queue[currentIndex]
      expect(activeCard).toBeDefined()
      expect(seenKeys.has(activeCard._sessionKey)).toBe(false)
      seenKeys.add(activeCard._sessionKey)

      const res = applyReviewToQueue(queue, currentIndex, false, statusMap)
      queue = res.nextQueue
      currentIndex = res.nextIndex
      statusMap = res.nextStatusMap
    }

    expect(seenKeys.size).toBe(5)
    expect(queue.length).toBe(6)
    expect(currentIndex).toBe(5)
  })

  it('TC-04: Undo after Forget removes the inserted copy and restores status without leaving ghost cards', () => {
    const { queue, statusMap } = initSessionQueue(dummyCards)
    // Forget Card 1 (index 0)
    const reviewRes = applyReviewToQueue(queue, 0, false, statusMap)
    expect(reviewRes.nextQueue).toHaveLength(4) // Card 1 inserted at index 3
    expect(reviewRes.nextIndex).toBe(1)
    expect(reviewRes.nextStatusMap.get(1)).toBe('secondReview')

    // Undo the Forget
    const undoRes = applyUndoToQueue(reviewRes.nextQueue, reviewRes.nextIndex, reviewRes.action, reviewRes.nextStatusMap)
    expect(undoRes.nextQueue).toHaveLength(3) // Inserted copy cleanly removed!
    expect(undoRes.nextIndex).toBe(0)
    expect(undoRes.nextStatusMap.get(1)).toBe('toReview')

    const stats = computeSessionStats(undoRes.nextStatusMap)
    expect(stats.toReview).toBe(3)
    expect(stats.forgotten).toBe(0)
  })

  it('TC-05: Undo after Got it reverts index and status accurately', () => {
    const { queue, statusMap } = initSessionQueue(dummyCards)
    // Got it for Card 1 (index 0)
    const reviewRes = applyReviewToQueue(queue, 0, true, statusMap)
    expect(reviewRes.nextQueue).toHaveLength(3)
    expect(reviewRes.nextIndex).toBe(1)
    expect(reviewRes.nextStatusMap.get(1)).toBe('memorized')

    // Undo the Got it
    const undoRes = applyUndoToQueue(reviewRes.nextQueue, reviewRes.nextIndex, reviewRes.action, reviewRes.nextStatusMap)
    expect(undoRes.nextQueue).toHaveLength(3)
    expect(undoRes.nextIndex).toBe(0)
    expect(undoRes.nextStatusMap.get(1)).toBe('toReview')

    const stats = computeSessionStats(undoRes.nextStatusMap)
    expect(stats.toReview).toBe(3)
    expect(stats.memorized).toBe(0)
  })

  it('TC-06: Second review success transitions card from forgotten to memorized', () => {
    const { queue, statusMap } = initSessionQueue([{ id: 1, front: 'F', back: 'B', type: 'Daily Words' }])

    // 1st encounter: Forget
    const res1 = applyReviewToQueue(queue, 0, false, statusMap)
    expect(res1.nextStatusMap.get(1)).toBe('secondReview')
    expect(computeSessionStats(res1.nextStatusMap)).toEqual({ memorized: 0, forgotten: 1, toReview: 0 })

    // 2nd encounter: Got it
    const res2 = applyReviewToQueue(res1.nextQueue, res1.nextIndex, true, res1.nextStatusMap)
    expect(res2.nextStatusMap.get(1)).toBe('memorized')
    expect(computeSessionStats(res2.nextStatusMap)).toEqual({ memorized: 1, forgotten: 0, toReview: 0 })
    expect(res2.nextIndex).toBe(2)
    expect(res2.nextIndex >= res2.nextQueue.length).toBe(true) // Finished!
  })

  it('TC-07: Shuffle only affects remaining cards and preserves done cards', () => {
    const cards = [
      { id: 1, front: '1', back: '1', type: 'A' },
      { id: 2, front: '2', back: '2', type: 'A' },
      { id: 3, front: '3', back: '3', type: 'A' },
      { id: 4, front: '4', back: '4', type: 'A' },
      { id: 5, front: '5', back: '5', type: 'A' }
    ]
    const { queue } = initSessionQueue(cards)
    const currentIndex = 2 // First 2 cards (0, 1) are done

    const shuffleRes = applyShuffleToQueue(queue, currentIndex)
    expect(shuffleRes.shuffledCount).toBe(3)
    expect(shuffleRes.nextQueue).toHaveLength(5)
    // Done cards (indexes 0, 1) must remain identical
    expect(shuffleRes.nextQueue[0]._sessionKey).toBe(queue[0]._sessionKey)
    expect(shuffleRes.nextQueue[1]._sessionKey).toBe(queue[1]._sessionKey)
  })

  it('TC-08: Shuffle on 1 remaining card returns unchanged count', () => {
    const { queue } = initSessionQueue([{ id: 1, front: '1', back: '1', type: 'A' }])
    const shuffleRes = applyShuffleToQueue(queue, 0)
    expect(shuffleRes.shuffledCount).toBe(1)
    expect(shuffleRes.nextQueue).toBe(queue)
  })

  it('TC-09: Skip card moves active card to the end and presents next card', () => {
    const { queue } = initSessionQueue(dummyCards)
    const skipRes = applySkipToQueue(queue, 0)
    expect(skipRes.nextQueue).toHaveLength(3)
    expect(skipRes.nextQueue[0].id).toBe(2) // Next card is now Card 2
    expect(skipRes.nextQueue[1].id).toBe(3)
    expect(skipRes.nextQueue[2].id).toBe(1) // Card 1 moved to end
  })

  it('TC-10: Skip on single card refreshes its session key', () => {
    const { queue } = initSessionQueue([{ id: 1, front: '1', back: '1', type: 'A' }])
    const oldKey = queue[0]._sessionKey
    const skipRes = applySkipToQueue(queue, 0)
    expect(skipRes.nextQueue).toHaveLength(1)
    expect(skipRes.nextQueue[0]._sessionKey).not.toBe(oldKey)
  })

  it('TC-11: Sync card text updates all instances of that card in queue', () => {
    let { queue, statusMap } = initSessionQueue([{ id: 1, front: 'Old Front', back: 'Old Back', type: 'A' }])
    // Forget to create a second copy in queue
    const res = applyReviewToQueue(queue, 0, false, statusMap)
    expect(res.nextQueue).toHaveLength(2)

    const synced = syncCardTextInQueue(res.nextQueue, 1, 'New Front', 'New Back')
    expect(synced[0].front).toBe('New Front')
    expect(synced[0].back).toBe('New Back')
    expect(synced[1].front).toBe('New Front')
    expect(synced[1].back).toBe('New Back')
  })
})
