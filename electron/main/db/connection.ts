import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

export function projectCJK(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/([\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Initialize the database in the user data directory (or in-memory for testing)
const dbPath = (app && typeof app.getPath === 'function') 
  ? path.join(app.getPath('userData'), 'wordie.sqlite') 
  : ':memory:'
export const db: BetterSqlite3Database = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

try {
  db.function('cjk_unigram', (str: any) => projectCJK(str))
} catch (e) {
  // Ignore if already registered
}
