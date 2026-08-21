export type CardReviewStatus = 'toReview' | 'secondReview' | 'memorized'

export interface SessionCardItem {
  id: number
  type: string
  front: string
  back: string
  label?: string
  style?: string
  sourceContext?: string
  imageUrl?: string
  encounterCount?: number
  repetitions?: number
  interval?: number
  easeFactor?: number
  state?: number
  lapses?: number
  nextReviewDate?: string | null
  _sessionKey: string
  isSecondReview?: boolean
}

export type ReviewAction =
  | { type: 'memorized'; cardId: number; prevStatus: CardReviewStatus }
  | { type: 'forget'; cardId: number; insertedKey: string; prevStatus: CardReviewStatus }

export interface SessionStats {
  memorized: number
  forgotten: number
  toReview: number
}

let sessionKeySequence = 0

export function generateSessionKey(cardId: number): string {
  sessionKeySequence += 1
  return `${cardId}_${Date.now()}_${sessionKeySequence}_${Math.random().toString(36).slice(2, 7)}`
}

export function createSessionItem(card: any): SessionCardItem {
  return {
    ...card,
    _sessionKey: generateSessionKey(card.id)
  }
}

export function initSessionQueue(cards: any[]): {
  queue: SessionCardItem[]
  statusMap: Map<number, CardReviewStatus>
} {
  const queue = (cards || []).map(card => createSessionItem(card))
  const statusMap = new Map<number, CardReviewStatus>()
  for (const card of cards || []) {
    statusMap.set(card.id, 'toReview')
  }
  return { queue, statusMap }
}

export function computeSessionStats(statusMap: Map<number, CardReviewStatus>): SessionStats {
  let memorized = 0
  let forgotten = 0
  let toReview = 0
  statusMap.forEach(status => {
    if (status === 'memorized') memorized++
    else if (status === 'secondReview') forgotten++
    else if (status === 'toReview') toReview++
  })
  return { memorized, forgotten, toReview }
}

export function applyReviewToQueue(
  queue: SessionCardItem[],
  currentIndex: number,
  isCorrect: boolean,
  statusMap: Map<number, CardReviewStatus>
): {
  nextQueue: SessionCardItem[]
  nextIndex: number
  nextStatusMap: Map<number, CardReviewStatus>
  action: ReviewAction
} {
  if (currentIndex >= queue.length) {
    return {
      nextQueue: queue,
      nextIndex: currentIndex,
      nextStatusMap: statusMap,
      action: { type: 'memorized', cardId: 0, prevStatus: 'toReview' }
    }
  }

  const currentCard = queue[currentIndex]
  const prevStatus = statusMap.get(currentCard.id) || 'toReview'
  const nextStatusMap = new Map(statusMap)
  nextStatusMap.set(currentCard.id, isCorrect ? 'memorized' : 'secondReview')

  let nextQueue = [...queue]
  let action: ReviewAction

  if (!isCorrect) {
    const nextItem: SessionCardItem = {
      ...currentCard,
      _sessionKey: generateSessionKey(currentCard.id),
      isSecondReview: true
    }
    const insertIdx = Math.min(currentIndex + 4, nextQueue.length)
    nextQueue.splice(insertIdx, 0, nextItem)
    action = {
      type: 'forget',
      cardId: currentCard.id,
      insertedKey: nextItem._sessionKey,
      prevStatus
    }
  } else {
    action = {
      type: 'memorized',
      cardId: currentCard.id,
      prevStatus
    }
  }

  return {
    nextQueue,
    nextIndex: currentIndex + 1,
    nextStatusMap,
    action
  }
}

export function applyUndoToQueue(
  queue: SessionCardItem[],
  currentIndex: number,
  action: ReviewAction,
  statusMap: Map<number, CardReviewStatus>
): {
  nextQueue: SessionCardItem[]
  nextIndex: number
  nextStatusMap: Map<number, CardReviewStatus>
} {
  const nextStatusMap = new Map(statusMap)
  nextStatusMap.set(action.cardId, action.prevStatus)

  let nextQueue = queue
  if (action.type === 'forget') {
    nextQueue = queue.filter(item => item._sessionKey !== action.insertedKey)
  }

  return {
    nextQueue,
    nextIndex: Math.max(0, currentIndex - 1),
    nextStatusMap
  }
}

export function applySkipToQueue(
  queue: SessionCardItem[],
  currentIndex: number
): {
  nextQueue: SessionCardItem[]
} {
  if (currentIndex >= queue.length) return { nextQueue: queue }
  if (queue.length <= 1) {
    const updated = { ...queue[0], _sessionKey: generateSessionKey(queue[0].id) }
    return { nextQueue: [updated] }
  }
  const next = [...queue]
  const [skipped] = next.splice(currentIndex, 1)
  next.push(skipped)
  return { nextQueue: next }
}

export function applyShuffleToQueue(
  queue: SessionCardItem[],
  currentIndex: number
): {
  nextQueue: SessionCardItem[]
  shuffledCount: number
} {
  const remainingCount = queue.length - currentIndex
  if (remainingCount <= 1) {
    return { nextQueue: queue, shuffledCount: remainingCount }
  }

  const done = queue.slice(0, currentIndex)
  const remaining = [...queue.slice(currentIndex)]

  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }

  const currentCard = queue[currentIndex]
  if (remaining.length > 1 && currentCard && remaining[0].id === currentCard.id) {
    const swapIdx = 1 + Math.floor(Math.random() * (remaining.length - 1));
    [remaining[0], remaining[swapIdx]] = [remaining[swapIdx], remaining[0]]
  }

  return {
    nextQueue: [...done, ...remaining],
    shuffledCount: remainingCount
  }
}

export function syncCardTextInQueue(
  queue: SessionCardItem[],
  cardId: number,
  front: string,
  back: string
): SessionCardItem[] {
  return queue.map(c => (c.id === cardId ? { ...c, front, back } : c))
}
