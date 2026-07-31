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
      useCount INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      interval INTEGER DEFAULT 0,
      easeFactor REAL DEFAULT 2.5,
      nextReviewDate TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

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
      INSERT INTO cards (type, front, back, style, label, nextReviewDate)
      VALUES (@type, @front, @back, @style, @label, @nextReviewDate)
    `)
    const result = stmt.run({
      type: card.type,
      front: card.front,
      back: card.back,
      style: card.style || null,
      label: card.label || null,
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
    const stmt = db.prepare('UPDATE cards SET useCount = useCount + 1 WHERE id = ?')
    stmt.run(id)
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
