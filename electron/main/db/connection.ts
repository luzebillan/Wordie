import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

// Initialize the database in the user data directory
const dbPath = path.join(app.getPath('userData'), 'wordie.sqlite')
export const db: BetterSqlite3Database = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
