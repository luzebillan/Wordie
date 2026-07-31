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
  
  deleteCard: (id: number) => {
    const stmt = db.prepare('DELETE FROM cards WHERE id = ?')
    stmt.run(id)
    return { success: true }
  }
}
