import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

// Initialize the database in the user data directory
const dbPath = path.join(app.getPath('userData'), 'cardsapp.sqlite')
export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      style TEXT,
      label TEXT,
      imageUrl TEXT,
      sourceContext TEXT,
      useCount INTEGER DEFAULT 0,
      encounterCount INTEGER DEFAULT 0,
      manualReviewCount INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      interval INTEGER DEFAULT 0,
      easeFactor REAL DEFAULT 2.5,
      nextReviewDate TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Safely add new columns if the table already exists from an older version
  try {
    db.exec(`ALTER TABLE cards ADD COLUMN imageUrl TEXT`)
  } catch (e) { /* Column likely exists */ }
  
  try {
    db.exec(`ALTER TABLE cards ADD COLUMN sourceContext TEXT`)
  } catch (e) { /* Column likely exists */ }
  
  try {
    db.exec(`ALTER TABLE cards ADD COLUMN encounterCount INTEGER DEFAULT 0`)
  } catch (e) { /* Column likely exists */ }

  try {
    db.exec(`ALTER TABLE cards ADD COLUMN manualReviewCount INTEGER DEFAULT 0`)
  } catch (e) { /* Column likely exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cardId INTEGER NOT NULL,
      isCorrect BOOLEAN NOT NULL,
      isFirstTry BOOLEAN NOT NULL,
      reviewDate TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(cardId) REFERENCES cards(id) ON DELETE CASCADE
    )
  `)
}

// IPC Handlers implementation for DB operations
export const dbHandlers = {
  createCard: (card: any) => {
    const stmt = db.prepare(`
      INSERT INTO cards (type, front, back, style, label, imageUrl, sourceContext, nextReviewDate)
      VALUES (@type, @front, @back, @style, @label, @imageUrl, @sourceContext, @nextReviewDate)
    `)
    const result = stmt.run({
      type: card.type,
      front: card.front,
      back: card.back,
      style: card.style || null,
      label: card.label || null,
      imageUrl: card.imageUrl || null,
      sourceContext: card.sourceContext || null,
      nextReviewDate: card.nextReviewDate || new Date().toISOString()
    })
    return { id: result.lastInsertRowid, ...card }
  },
  
  getCards: () => {
    return db.prepare('SELECT * FROM cards ORDER BY createdAt DESC').all()
  },
  
  getCard: (id: number) => {
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(id)
  },
  
  searchCards: (front: string, back: string = '', type?: string) => {
    if (!front && !back) return []
    
    // If only front is provided (typing in input), use fast SQL LIKE query
    if (front && !back) {
      if (type) {
        return db.prepare("SELECT * FROM cards WHERE type = ? AND (front LIKE ? OR back LIKE ?) ORDER BY createdAt DESC LIMIT 10").all(type, `%${front}%`, `%${front}%`)
      }
      return db.prepare("SELECT * FROM cards WHERE front LIKE ? OR back LIKE ? ORDER BY createdAt DESC LIMIT 10").all(`%${front}%`, `%${front}%`)
    }
    
    // If back is provided (AI generated), do an in-memory TF-like similarity ranking
    let allCards = []
    if (type) {
      allCards = db.prepare("SELECT * FROM cards WHERE type = ? ORDER BY createdAt DESC").all(type) as any[]
    } else {
      allCards = db.prepare("SELECT * FROM cards ORDER BY createdAt DESC").all() as any[]
    }
    
    // ONLY extract tokens from the BACK side (the meaning/definition) to avoid literal string matching from the front side
    const backText = back.toLowerCase()
    const tokens = new Set<string>()
    
    // Basic stop words to ignore
    const stopWords = new Set([
      // English stopwords
      'this', 'that', 'with', 'from', 'your', 'what', 'have', 'meaning', 'translation', 'example', 'sentence', 'context',
      'when', 'they', 'them', 'there', 'their', 'some', 'about', 'would', 'could', 'should', 'which', 'where', 'whose',
      'because', 'however', 'therefore', 'then', 'than', 'only', 'very', 'much', 'many', 'more', 'most', 'such', 'into',
      'been', 'were', 'being', 'does', 'doing', 'done', 'will', 'shall', 'used', 'someone', 'something', 'anyone', 'anything',
      
      // Chinese stop bigrams
      '这个', '那个', '这是', '就是', '我们', '你们', '他们', '可以', '但是', '因为', '所以', '如果', '或者', '并且',
      '而且', '虽然', '即使', '用于', '表示', '释义', '意思', '例句', '翻译', '解释', '一个', '一种', '一些', '这些',
      '那些', '非常', '比较', '其实', '只是', '还是', '这样', '那样', '怎么', '什么'
    ])
    
    const engMatch = backText.match(/[a-z]{4,}/g)
    if (engMatch) {
      engMatch.forEach(w => {
        if (!stopWords.has(w)) tokens.add(w)
      })
    }
    
    const zhChars = backText.match(/[\u4e00-\u9fa5]/g)
    if (zhChars) {
      // Create bigrams for Chinese
      for (let i = 0; i < zhChars.length - 1; i++) {
        const bigram = zhChars[i] + zhChars[i+1]
        if (!stopWords.has(bigram)) tokens.add(bigram)
      }
    }
    
    if (tokens.size === 0) return []
    
    const scoredCards = allCards.map(card => {
      let score = 0
      
      // Match against the OTHER card's back side ONLY
      const otherBackText = (card.back || '').toLowerCase()
      
      // Boost exact/partial front match to maintain duplicate checker priority
      if (front) {
        if (card.front.toLowerCase() === front.toLowerCase()) {
          score += 50
        } else if (card.front.toLowerCase().includes(front.toLowerCase())) {
          score += 20
        }
      }
      
      tokens.forEach(token => {
        if (otherBackText.includes(token)) score += 2 // meaning match gets points
      })
      
      return { card, score }
    })
    
    return scoredCards
      // Require at least 2 points (either one meaning match, or a literal match)
      .filter(s => s.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.card)
  },
  
  incrementUseCount: (id: number) => {
    db.exec(`UPDATE cards SET useCount = useCount + 1 WHERE id = ${id}`)
  },

  incrementEncounterCount: (id: number) => {
    db.exec(`UPDATE cards SET encounterCount = encounterCount + 1 WHERE id = ${id}`)
  },

  incrementManualReviewCount: (id: number) => {
    db.exec(`UPDATE cards SET manualReviewCount = manualReviewCount + 1 WHERE id = ${id}`)
  },

  getDueCards: () => {
    const today = new Date().toISOString().split('T')[0]
    const stmt = db.prepare(`SELECT * FROM cards WHERE nextReviewDate IS NULL OR date(nextReviewDate) <= ? ORDER BY RANDOM() LIMIT 50`)
    return stmt.all(today)
  },

  getRandomCards: (limit: number = 8) => {
    const stmt = db.prepare(`SELECT * FROM cards ORDER BY RANDOM() LIMIT ?`)
    return stmt.all(limit)
  },

  updateCardText: (id: number, front: string, back: string) => {
    const stmt = db.prepare(`UPDATE cards SET front = ?, back = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
    stmt.run(front, back, id)
    return { success: true }
  },

  reviewCard: (id: number, isCorrect: boolean) => {
    const cardStmt = db.prepare(`SELECT * FROM cards WHERE id = ?`)
    const card = cardStmt.get(id) as any
    if (!card) return { success: false, error: 'Card not found' }

    let { repetitions, interval, easeFactor } = card

    if (!isCorrect) {
      // Forget (Quality 1)
      repetitions = 0
      interval = 1
      easeFactor = Math.max(1.3, easeFactor - 0.2)
    } else {
      // Got it (Quality 4 equivalent)
      if (repetitions === 0) {
        interval = 1
      } else if (repetitions === 1) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor)
      }
      repetitions += 1
      easeFactor = easeFactor // Quality 4 doesn't change EF in standard SM-2
    }

    // nextReviewDate = now + interval days
    const nextReviewDate = new Date()
    nextReviewDate.setDate(nextReviewDate.getDate() + interval)
    const nextReviewIso = nextReviewDate.toISOString()

    // Increment encounter count because a review is an encounter (even if forgotten, but we'll increment for all reviews or just correct ones? The user said Got it! so let's increment if correct. Actually, an encounter is an encounter. I'll just increment it.)
    const encounterIncrement = isCorrect ? 1 : 1; 

    const updateStmt = db.prepare(`
      UPDATE cards 
      SET repetitions = ?, interval = ?, easeFactor = ?, nextReviewDate = ?, encounterCount = encounterCount + ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    updateStmt.run(repetitions, interval, easeFactor, nextReviewIso, encounterIncrement, id)

    // Logging logic
    const today = new Date().toISOString().split('T')[0]
    
    // Check if reviewed today
    const checkLogStmt = db.prepare(`SELECT COUNT(*) as count FROM review_logs WHERE cardId = ? AND date(reviewDate) = ?`)
    const logCheck = checkLogStmt.get(id, today) as any
    const isFirstTry = logCheck.count === 0

    const logStmt = db.prepare(`
      INSERT INTO review_logs (cardId, isCorrect, isFirstTry)
      VALUES (?, ?, ?)
    `)
    logStmt.run(id, isCorrect ? 1 : 0, isFirstTry ? 1 : 0)

    return { success: true }
  },
  
  deleteCard: (id: number) => {
    const stmt = db.prepare('DELETE FROM cards WHERE id = ?')
    stmt.run(id)
    return { success: true }
  },
  
  getSettings: () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[]
    const settings: Record<string, string> = {}
    rows.forEach(row => {
      settings[row.key] = row.value
    })
    return settings
  },
  
  saveSettings: (settings: Record<string, string>) => {
    const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)')
    const transaction = db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        insert.run({ key, value: String(value) })
      }
    })
    transaction(settings)
    return { success: true }
  },
  
  getStats: () => {
    const today = new Date().toISOString().split('T')[0]
    
    // Cards Reviewed Today
    const reviewedCountStmt = db.prepare(`SELECT COUNT(DISTINCT cardId) as count FROM review_logs WHERE date(reviewDate) = ?`)
    const reviewedCount = (reviewedCountStmt.get(today) as any).count
    
    // Retention Rate Today (first try correct / total first tries today)
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
  },
  
  clearDatabase: () => {
    db.transaction(() => {
      db.exec('DELETE FROM review_logs')
      db.exec('DELETE FROM cards')
      // Reset sqlite sequence for auto-increment IDs
      db.exec("DELETE FROM sqlite_sequence WHERE name='cards' OR name='review_logs'")
    })()
    return { success: true }
  },

  importCards: (cards: any[]) => {
    let imported = 0
    let skipped = 0
    
    const checkStmt = db.prepare('SELECT id FROM cards WHERE front = ? AND type = ?')
    const insertStmt = db.prepare(`
      INSERT INTO cards (type, front, back, style, label, imageUrl, sourceContext, useCount, encounterCount, manualReviewCount, repetitions, interval, easeFactor, nextReviewDate, createdAt)
      VALUES (@type, @front, @back, @style, @label, @imageUrl, @sourceContext, @useCount, @encounterCount, @manualReviewCount, @repetitions, @interval, @easeFactor, @nextReviewDate, @createdAt)
    `)
    
    const transaction = db.transaction((cardsToImport: any[]) => {
      for (const card of cardsToImport) {
        // Skip duplicates based on front and type
        const existing = checkStmt.get(card.front, card.type)
        if (existing) {
          skipped++
          continue
        }
        
        insertStmt.run({
          type: card.type,
          front: card.front,
          back: card.back,
          style: card.style || null,
          label: card.label || null,
          imageUrl: card.imageUrl || null,
          sourceContext: card.sourceContext || null,
          useCount: card.useCount || 0,
          encounterCount: card.encounterCount || 0,
          manualReviewCount: card.manualReviewCount || 0,
          repetitions: card.repetitions || 0,
          interval: card.interval || 0,
          easeFactor: card.easeFactor || 2.5,
          nextReviewDate: card.nextReviewDate || null,
          createdAt: card.createdAt || new Date().toISOString()
        })
        imported++
      }
    })
    
    try {
      transaction(cards)
      return { success: true, imported, skipped }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
}
