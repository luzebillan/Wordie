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
  
  searchCards: (query: string) => {
    if (!query) return []
    // Search both front and back
    return db.prepare("SELECT * FROM cards WHERE front LIKE ? OR back LIKE ? ORDER BY createdAt DESC LIMIT 10").all(`%${query}%`, `%${query}%`)
  },
  
  incrementUseCount: (id: number) => {
    db.exec(`UPDATE cards SET useCount = useCount + 1 WHERE id = ${id}`)
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

    const updateStmt = db.prepare(`
      UPDATE cards 
      SET repetitions = ?, interval = ?, easeFactor = ?, nextReviewDate = ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    updateStmt.run(repetitions, interval, easeFactor, nextReviewIso, id)

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
  }
}
