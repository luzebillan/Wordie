import { db, projectCJK } from './connection'
import { clearVectorTable, addCardVectorsBatch } from '../vector_db'
import { getEmbedding, getEmbeddingsBatch } from '../semantic'
import { initSettings } from '../config'

export { projectCJK }

export function initDB() {
  // Register SQLite custom function for CJK unigram projection
  try {
    db.function('cjk_unigram', (str: any) => projectCJK(str));
  } catch (e) {
    // Ignore if already registered
  }

  const versionInfo = db.prepare('PRAGMA user_version').get() as { user_version: number };
  let currentVersion = versionInfo.user_version;

  // Always ensure internal metadata table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

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

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
        front, back, label, style, sourceContext,
        content=''
      )
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid, front, back, label, style, sourceContext) 
        VALUES (new.id, cjk_unigram(new.front), cjk_unigram(new.back), cjk_unigram(new.label), cjk_unigram(new.style), cjk_unigram(new.sourceContext));
      END;
      CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, front, back, label, style, sourceContext) 
        VALUES ('delete', old.id, cjk_unigram(old.front), cjk_unigram(old.back), cjk_unigram(old.label), cjk_unigram(old.style), cjk_unigram(old.sourceContext));
      END;
      CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, front, back, label, style, sourceContext) 
        VALUES ('delete', old.id, cjk_unigram(old.front), cjk_unigram(old.back), cjk_unigram(old.label), cjk_unigram(old.style), cjk_unigram(old.sourceContext));
        INSERT INTO cards_fts(rowid, front, back, label, style, sourceContext) 
        VALUES (new.id, cjk_unigram(new.front), cjk_unigram(new.back), cjk_unigram(new.label), cjk_unigram(new.style), cjk_unigram(new.sourceContext));
      END;
    `);

    // Populate FTS table from cards if any exist
    db.exec(`
      INSERT INTO cards_fts(rowid, front, back, label, style, sourceContext)
      SELECT id, cjk_unigram(front), cjk_unigram(back), cjk_unigram(label), cjk_unigram(style), cjk_unigram(sourceContext)
      FROM cards;
    `);

    db.prepare(`INSERT OR REPLACE INTO db_meta (key, value) VALUES ('fts_version', 'cjk_unigram_v1')`).run();

    db.pragma('user_version = 1');
    currentVersion = 1;
  }

  // Upgrade existing DB cards_fts to CJK unigram projection if not yet migrated
  try {
    const ftsVersionRow = db.prepare(`SELECT value FROM db_meta WHERE key = 'fts_version'`).get() as any;
    if (!ftsVersionRow || ftsVersionRow.value !== 'cjk_unigram_v1') {
      console.log("[DB Migration] Upgrading cards_fts table to CJK unigram projection...");
      db.exec(`
        DROP TRIGGER IF EXISTS cards_ai;
        DROP TRIGGER IF EXISTS cards_ad;
        DROP TRIGGER IF EXISTS cards_au;
        DROP TABLE IF EXISTS cards_fts;

        CREATE VIRTUAL TABLE cards_fts USING fts5(
          front, back, label, style, sourceContext,
          content=''
        );

        CREATE TRIGGER cards_ai AFTER INSERT ON cards BEGIN
          INSERT INTO cards_fts(rowid, front, back, label, style, sourceContext) 
          VALUES (new.id, cjk_unigram(new.front), cjk_unigram(new.back), cjk_unigram(new.label), cjk_unigram(new.style), cjk_unigram(new.sourceContext));
        END;
        CREATE TRIGGER cards_ad AFTER DELETE ON cards BEGIN
          INSERT INTO cards_fts(cards_fts, rowid, front, back, label, style, sourceContext) 
          VALUES ('delete', old.id, cjk_unigram(old.front), cjk_unigram(old.back), cjk_unigram(old.label), cjk_unigram(old.style), cjk_unigram(old.sourceContext));
        END;
        CREATE TRIGGER cards_au AFTER UPDATE ON cards BEGIN
          INSERT INTO cards_fts(cards_fts, rowid, front, back, label, style, sourceContext) 
          VALUES ('delete', old.id, cjk_unigram(old.front), cjk_unigram(old.back), cjk_unigram(old.label), cjk_unigram(old.style), cjk_unigram(old.sourceContext));
          INSERT INTO cards_fts(rowid, front, back, label, style, sourceContext) 
          VALUES (new.id, cjk_unigram(new.front), cjk_unigram(new.back), cjk_unigram(new.label), cjk_unigram(new.style), cjk_unigram(new.sourceContext));
        END;

        INSERT INTO cards_fts(rowid, front, back, label, style, sourceContext)
        SELECT id, cjk_unigram(front), cjk_unigram(back), cjk_unigram(label), cjk_unigram(style), cjk_unigram(sourceContext)
        FROM cards;

        INSERT OR REPLACE INTO db_meta (key, value) VALUES ('fts_version', 'cjk_unigram_v1');
      `);
      console.log("[DB Migration] cards_fts successfully upgraded to CJK unigram projection.");
    }
  } catch (e) {
    console.error("[DB Migration] Failed to upgrade cards_fts to CJK unigram projection:", e);
  }

  // Initialize config manager (and migrate legacy settings from SQLite if needed)
  initSettings(db);

  // Auto-migrate legacy backslashes '\' in cards.label to POSIX '/'
  try {
    const hasLegacyBackslashes = db.prepare("SELECT 1 FROM cards WHERE label LIKE '%\\%' LIMIT 1").get();
    if (hasLegacyBackslashes) {
      db.transaction(() => {
        db.exec("UPDATE cards SET label = REPLACE(label, '\\', '/') WHERE label LIKE '%\\%'");
      })();
      console.log("[DB Migration] Converted legacy backslashes to POSIX slashes in cards.label.");
    }
  } catch (e) {
    console.error("[DB Migration] Backslash to slash migration check skipped/failed:", e);
  }

  // Auto-clear legacy sourceContext for Useful Expressions cards
  try {
    const hasLegacyContext = db.prepare("SELECT 1 FROM cards WHERE type = 'Useful Expressions' AND sourceContext IS NOT NULL AND sourceContext != '' LIMIT 1").get();
    if (hasLegacyContext) {
      db.prepare("UPDATE cards SET sourceContext = NULL WHERE type = 'Useful Expressions'").run();
      console.log("[DB Migration] Cleared legacy sourceContext for Useful Expressions cards.");
    }
  } catch (e) {
    console.error("[DB Migration] Legacy sourceContext clear check skipped/failed:", e);
  }

  // Auto-clear legacy sourceContext for Daily Words cards
  try {
    const hasLegacyDailyWordsContext = db.prepare("SELECT 1 FROM cards WHERE type = 'Daily Words' AND sourceContext IS NOT NULL AND sourceContext != '' LIMIT 1").get();
    if (hasLegacyDailyWordsContext) {
      db.prepare("UPDATE cards SET sourceContext = NULL WHERE type = 'Daily Words'").run();
      console.log("[DB Migration] Cleared legacy sourceContext for Daily Words cards.");
    }
  } catch (e) {
    console.error("[DB Migration] Legacy sourceContext clear check for Daily Words skipped/failed:", e);
  }

  // Trigger vector migration asynchronously
  migrateVectors().catch(console.error);
}

async function migrateVectors() {
  let version: string | undefined;
  try {
    const metaRow = db.prepare(`SELECT value FROM db_meta WHERE key = 'semantic_model_version'`).get() as any;
    version = metaRow?.value;
  } catch {
    try {
      const settingsRow = db.prepare(`SELECT value FROM settings WHERE key = 'semantic_model_version'`).get() as any;
      version = settingsRow?.value;
    } catch {}
  }
  
  if (version !== 'multilingual_minilm_v1') {
    console.log("Migrating vector database to new model: Xenova/paraphrase-multilingual-MiniLM-L12-v2");
    await clearVectorTable();
    
    const cards = db.prepare('SELECT id, front, back, type FROM cards').all() as any[];
    const validCards = cards.filter(c => c.front && c.front.trim());
    const BATCH_SIZE = 32;

    for (let i = 0; i < validCards.length; i += BATCH_SIZE) {
      const batch = validCards.slice(i, i + BATCH_SIZE);
      const textsToEmbed = batch.map(c => c.back && c.back.trim() ? `${c.front}: ${c.back}` : c.front);

      try {
        const vectors = await getEmbeddingsBatch(textsToEmbed);
        const batchData = batch.map((card, idx) => ({
          id: card.id,
          front: card.front,
          type: card.type,
          vector: vectors[idx] || []
        })).filter(item => item.vector && item.vector.length > 0);

        if (batchData.length > 0) {
          await addCardVectorsBatch(batchData);
        }
      } catch (e) {
        console.error(`Failed to batch embed cards starting at index ${i}, falling back to single embeds:`, e);
        const batchData: { id: number; front: string; type: string; vector: number[] }[] = [];
        for (const card of batch) {
          const textToEmbed = card.back && card.back.trim() ? `${card.front}: ${card.back}` : card.front;
          try {
            const vector = await getEmbedding(textToEmbed);
            if (vector && vector.length > 0) {
              batchData.push({
                id: card.id,
                front: card.front,
                type: card.type,
                vector
              });
            }
          } catch (singleErr) {
            console.error(`Failed to embed card ${card.id}:`, singleErr);
          }
        }

        if (batchData.length > 0) {
          await addCardVectorsBatch(batchData);
        }
      }
    }
    
    db.prepare(`INSERT OR REPLACE INTO db_meta (key, value) VALUES ('semantic_model_version', 'multilingual_minilm_v1')`).run();
    console.log("Migration complete.");
  }
}
