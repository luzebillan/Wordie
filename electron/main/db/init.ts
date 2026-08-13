import { db } from './connection'
import { clearVectorTable, addCardVector } from '../vector_db'

export function initDB() {
  const versionInfo = db.prepare('PRAGMA user_version').get() as { user_version: number };
  let currentVersion = versionInfo.user_version;

  if (currentVersion === 0) {
    // Check if it's an existing legacy DB
    const hasCardsRow = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'").get();
    const hasCards = !!hasCardsRow;
    
    if (hasCards) {
      // Legacy DB: Ensure base review_logs exists before adding columns
      db.exec(`
        CREATE TABLE IF NOT EXISTS review_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cardId INTEGER NOT NULL,
          isCorrect BOOLEAN NOT NULL,
          isFirstTry BOOLEAN NOT NULL,
          reviewDate TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(cardId) REFERENCES cards(id) ON DELETE CASCADE
        )
      `);

      // Legacy DB migration: catch errors for columns that might already exist
      const legacyColumns = [
        "ALTER TABLE cards ADD COLUMN imageUrl TEXT",
        "ALTER TABLE cards ADD COLUMN sourceContext TEXT",
        "ALTER TABLE cards ADD COLUMN encounterCount INTEGER DEFAULT 0",
        "ALTER TABLE cards ADD COLUMN manualReviewCount INTEGER DEFAULT 0",
        "ALTER TABLE cards ADD COLUMN state INTEGER DEFAULT 0",
        "ALTER TABLE cards ADD COLUMN lapses INTEGER DEFAULT 0",
        "ALTER TABLE cards ADD COLUMN embedding TEXT",
        "ALTER TABLE review_logs ADD COLUMN previousState TEXT",
        "ALTER TABLE review_logs ADD COLUMN rating TEXT",
        "ALTER TABLE review_logs ADD COLUMN elapsedTime REAL"
      ];
      for (const query of legacyColumns) {
        try { db.exec(query) } catch (e) { /* ignore */ }
      }
    } else {
      // Fresh DB setup (V1)
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
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
          state INTEGER DEFAULT 0,
          lapses INTEGER DEFAULT 0,
          embedding TEXT
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS review_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cardId INTEGER NOT NULL,
          isCorrect BOOLEAN NOT NULL,
          rating TEXT,
          elapsedTime REAL,
          isFirstTry BOOLEAN NOT NULL,
          previousState TEXT,
          reviewDate TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(cardId) REFERENCES cards(id) ON DELETE CASCADE
        )
      `);
    }

    // Common V1 Setup
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
        front, back, label,
        content='cards', content_rowid='id'
      )
    `);

    // Populate FTS table if it's empty
    const count = db.prepare('SELECT COUNT(*) as c FROM cards_fts').get() as {c: number};
    if (count.c === 0) {
      db.exec(`INSERT INTO cards_fts(cards_fts) VALUES ('rebuild');`);
    }

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid, front, back, label) VALUES (new.id, new.front, new.back, new.label);
      END;
      CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, front, back, label) VALUES ('delete', old.id, old.front, old.back, old.label);
      END;
      CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, front, back, label) VALUES ('delete', old.id, old.front, old.back, old.label);
        INSERT INTO cards_fts(rowid, front, back, label) VALUES (new.id, new.front, new.back, new.label);
      END;
    `);

    db.pragma('user_version = 1');
    currentVersion = 1;
  }

  // Future migrations can go here:
  // if (currentVersion === 1) { ... db.pragma('user_version = 2'); currentVersion = 2; }

  // Async migration for vectors
  migrateVectors();
}

async function migrateVectors() {
  const settingsRow = db.prepare(`SELECT value FROM settings WHERE key = 'semantic_model_version'`).get() as any;
  const version = settingsRow?.value;
  
  if (version !== 'minilm_v1') {
    console.log("Migrating vector database to new model: Xenova/all-MiniLM-L6-v2");
    await clearVectorTable();
    
    const cards = db.prepare('SELECT id, front, back, type FROM cards').all() as any[];
    for (const card of cards) {
      if (card.front && card.back) {
        await addCardVector(card.id, card.front, card.back, card.type);
      }
    }
    
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('semantic_model_version', 'minilm_v1')`).run();
    console.log("Migration complete.");
  }
}
