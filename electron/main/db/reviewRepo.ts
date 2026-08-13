import { db } from './connection'
import { calculateAnkiReview } from '../../../src/utils/ankiSrs'

export const reviewRepo = {
  getDueCards: (randomize: boolean = false) => {
    // 3:00 AM day boundary is naturally handled because nextReviewDate has exact times.
    const now = new Date().toISOString()
    const orderClause = randomize ? 'RANDOM()' : 'nextReviewDate ASC, id ASC'
    const stmt = db.prepare(`SELECT * FROM cards WHERE nextReviewDate IS NULL OR nextReviewDate <= ? ORDER BY ${orderClause} LIMIT 50`)
    return stmt.all(now)
  },

  getRandomCards: (limit: number = 8) => {
    const stmt = db.prepare(`SELECT * FROM cards ORDER BY RANDOM() LIMIT ?`)
    return stmt.all(limit)
  },

  resetCardProgress: (id: number) => {
    try {
      db.prepare(`
        UPDATE cards 
        SET repetitions = 0, interval = 0, easeFactor = 2.5, state = 0, lapses = 0, nextReviewDate = NULL, encounterCount = 0, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(id)
      db.prepare('DELETE FROM review_logs WHERE cardId = ?').run(id)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  },

  resetCardsProgress: (ids: number[]) => {
    if (!ids || ids.length === 0) return { success: true }
    try {
      const updateStmt = db.prepare(`
        UPDATE cards 
        SET repetitions = 0, interval = 0, easeFactor = 2.5, state = 0, lapses = 0, nextReviewDate = NULL, encounterCount = 0, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      const deleteLogsStmt = db.prepare('DELETE FROM review_logs WHERE cardId = ?')
      
      db.transaction(() => {
        for (const id of ids) {
          updateStmt.run(id)
          deleteLogsStmt.run(id)
        }
      })()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  },

  reviewCard: (id: number, isCorrect: boolean, rating?: 'again' | 'hard' | 'good' | 'easy' | 1 | 2 | 3 | 4, elapsedTime?: number) => {
    const cardStmt = db.prepare(`SELECT * FROM cards WHERE id = ?`)
    const card = cardStmt.get(id) as any
    if (!card) return { success: false, error: 'Card not found' }

    let { repetitions, interval, easeFactor, encounterCount, state, lapses } = card
    const now = new Date();
    
    // Save previous state for undo
    const previousState = JSON.stringify({
      repetitions,
      interval,
      easeFactor,
      state: card.state,
      lapses: card.lapses,
      nextReviewDate: card.nextReviewDate,
      encounterCount
    })

    // Map rating to Anki SM-2 rating (1-4)
    let ankiRating: 1 | 2 | 3 | 4 = isCorrect ? 3 : 1;
    if (rating) {
      if (typeof rating === 'number') {
        ankiRating = rating as 1 | 2 | 3 | 4;
      } else {
        const ratingMap: Record<string, 1|2|3|4> = { again: 1, hard: 2, good: 3, easy: 4 };
        ankiRating = ratingMap[rating] || (isCorrect ? 3 : 1);
      }
    }

    const outcome = calculateAnkiReview({
      state,
      interval,
      easeFactor,
      lapses,
      repetitions
    }, ankiRating, now);

    const nextReviewIso = outcome.nextReviewDate.toISOString();
    const encounterIncrement = 1;

    const updateStmt = db.prepare(`
      UPDATE cards 
      SET repetitions = ?, interval = ?, easeFactor = ?, state = ?, lapses = ?, nextReviewDate = ?, encounterCount = encounterCount + ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    updateStmt.run(outcome.progress.repetitions, outcome.progress.interval, outcome.progress.easeFactor, outcome.progress.state, outcome.progress.lapses, nextReviewIso, encounterIncrement, id)

    // Check if reviewed today (in logical day)
    let logicalDayStart = new Date(now)
    if (logicalDayStart.getHours() < 3) {
      logicalDayStart.setDate(logicalDayStart.getDate() - 1)
    }
    logicalDayStart.setHours(3, 0, 0, 0)
    
    const checkLogStmt = db.prepare(`SELECT COUNT(*) as count FROM review_logs WHERE cardId = ? AND reviewDate >= ?`)
    const logCheck = checkLogStmt.get(id, logicalDayStart.toISOString()) as any
    const isFirstTry = logCheck.count === 0

    const ratingStr = typeof rating === 'number' ? ['again','hard','good','easy'][rating-1] : (rating || (isCorrect ? 'good' : 'again'));

    const logStmt = db.prepare(`
      INSERT INTO review_logs (cardId, isCorrect, rating, elapsedTime, isFirstTry, previousState)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const logResult = logStmt.run(id, isCorrect ? 1 : 0, ratingStr, elapsedTime || null, isFirstTry ? 1 : 0, previousState)

    return { success: true, logId: logResult.lastInsertRowid }
  },

  getRevisionStats: () => {
    const now = new Date()
    let logicalDayStart = new Date(now)
    if (logicalDayStart.getHours() < 3) {
      logicalDayStart.setDate(logicalDayStart.getDate() - 1)
    }
    logicalDayStart.setHours(3, 0, 0, 0)
    const logicalDayStartStr = logicalDayStart.toISOString()
    
    const nowIso = now.toISOString()
    
    const toReviewStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM cards c
      WHERE (c.nextReviewDate IS NULL OR c.nextReviewDate <= ?)
      AND c.id NOT IN (
        SELECT cardId FROM review_logs WHERE reviewDate >= ?
      )
    `)
    const toReview = (toReviewStmt.get(nowIso, logicalDayStartStr) as any).count
    
    const memorizedStmt = db.prepare(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cards c
      JOIN review_logs r ON c.id = r.cardId
      WHERE r.reviewDate >= ? AND c.nextReviewDate > ?
    `)
    const memorized = (memorizedStmt.get(logicalDayStartStr, nowIso) as any).count
    
    const forgottenStmt = db.prepare(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM cards c
      JOIN review_logs r ON c.id = r.cardId
      WHERE r.reviewDate >= ? AND (c.nextReviewDate IS NULL OR c.nextReviewDate <= ?)
    `)
    const forgotten = (forgottenStmt.get(logicalDayStartStr, nowIso) as any).count
    
    return { memorized, forgotten, toReview }
  },

  undoReview: () => {
    const log = db.prepare(`SELECT * FROM review_logs ORDER BY id DESC LIMIT 1`).get() as any;
    if (!log || !log.previousState) return { success: false, error: 'No undo history found' };
    
    try {
      const prevState = JSON.parse(log.previousState);
      const updateStmt = db.prepare(`
        UPDATE cards 
        SET repetitions = ?, interval = ?, easeFactor = ?, state = ?, lapses = ?, nextReviewDate = ?, encounterCount = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      updateStmt.run(prevState.repetitions, prevState.interval, prevState.easeFactor, prevState.state || 0, prevState.lapses || 0, prevState.nextReviewDate, prevState.encounterCount, log.cardId);
      
      db.prepare(`DELETE FROM review_logs WHERE id = ?`).run(log.id);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to restore state' };
    }
  },
  
  getStats: () => {
    const today = new Date().toISOString().split('T')[0]
    
    // Cards Reviewed Today
    const reviewedCountStmt = db.prepare(`SELECT COUNT(DISTINCT cardId) as count FROM review_logs WHERE date(reviewDate) = ?`)
    const reviewedCount = (reviewedCountStmt.get(today) as any).count
    
    // Retention Rate Today
    const firstTriesStmt = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) as correct FROM review_logs WHERE date(reviewDate) = ? AND isFirstTry = 1`)
    const firstTriesData = firstTriesStmt.get(today) as any
    const retentionRate = firstTriesData.total > 0 ? (firstTriesData.correct / firstTriesData.total) * 100 : 0
    
    // Cards To Review Today
    const toReviewStmt = db.prepare(`SELECT COUNT(*) as count FROM cards WHERE nextReviewDate IS NULL OR date(nextReviewDate) <= ?`)
    const toReviewCount = (toReviewStmt.get(today) as any).count
    
    return {
      cardsReviewed: reviewedCount,
      retentionRate: Math.round(retentionRate),
      cardsToReview: toReviewCount
    }
  },

  getStatsByType: (type: string) => {
    const today = new Date().toISOString().split('T')[0]
    
    // Cards Reviewed Today
    const reviewedCountStmt = db.prepare(`
      SELECT COUNT(DISTINCT r.cardId) as count 
      FROM review_logs r 
      JOIN cards c ON r.cardId = c.id 
      WHERE date(r.reviewDate) = ? AND c.type = ?
    `)
    const reviewedCount = (reviewedCountStmt.get(today, type) as any).count
    
    // Cards To Review Today
    const toReviewStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM cards 
      WHERE type = ? AND (nextReviewDate IS NULL OR date(nextReviewDate) <= ?)
    `)
    const toReviewCount = (toReviewStmt.get(type, today) as any).count
    
    return {
      cardsReviewed: reviewedCount,
      cardsToReview: toReviewCount
    }
  }
}
