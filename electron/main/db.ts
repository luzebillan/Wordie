import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'
import { getEmbedding } from './semantic'
import { addCardVector, updateCardVector, deleteCardVector, searchCardVectors, clearVectorTable } from './vector_db'
import natural from 'natural'
import { aiFilterSynonyms } from './ai'

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

  try {
    db.exec(`ALTER TABLE cards ADD COLUMN embedding TEXT`)
  } catch (e) { /* Column likely exists */ }

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
      front, back, label,
      content='cards', content_rowid='id'
    )
  `)

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

  try {
    db.exec(`ALTER TABLE review_logs ADD COLUMN previousState TEXT`)
  } catch (e) { /* Column likely exists */ }
  
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

// Embedding cache logic replaced by LanceDB

// Helper: Lexical Overlap for Two-Stage Retrieval Precision
const tokenizer = new natural.WordTokenizer();
const stopWords = new Set(["a", "an", "the", "and", "or", "but", "if", "because", "as", "what", "which", "this", "that", "these", "those", "then", "just", "so", "than", "such", "both", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can", "will", "just", "don", "should", "now", "feeling", "someone", "something", "cause", "causing", "express", "expressing", "feel", "make", "person"]);

function getLexicalOverlap(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const tokens1 = tokenizer.tokenize(text1.toLowerCase()) || [];
  const tokens2 = tokenizer.tokenize(text2.toLowerCase()) || [];
  
  const set1 = new Set(tokens1.filter(t => !stopWords.has(t) && t.length > 2).map(t => natural.PorterStemmer.stem(t)));
  const set2 = new Set(tokens2.filter(t => !stopWords.has(t) && t.length > 2).map(t => natural.PorterStemmer.stem(t)));
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

// IPC Handlers implementation for DB operations
export const dbHandlers = {
  createCard: async (card: any) => {
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
    
    // Sync vector to LanceDB
    await addCardVector(result.lastInsertRowid as number, card.front, card.back, card.type)
    
    return { id: result.lastInsertRowid, ...card }
  },
  
  getCards: () => {
    return db.prepare('SELECT * FROM cards ORDER BY createdAt DESC').all()
  },
  
  getCard: (id: number) => {
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(id)
  },
  
  searchCards: (query: string = '', type?: string) => {
    if (!query) {
      if (type) {
        return db.prepare('SELECT * FROM cards WHERE type = ? ORDER BY createdAt DESC').all(type);
      }
      return db.prepare('SELECT * FROM cards ORDER BY createdAt DESC').all();
    }
    
    // Keyword / Fuzzy string matching using SQLite FTS5 (BM25)
    const ftsSearchTerms = query.replace(/["]/g, "").trim().split(/\s+/).filter(Boolean);
    const safeQuery = ftsSearchTerms.map(term => `"${term}"*`).join(' OR ');
    
    if (safeQuery) {
      try {
        if (type) {
          return db.prepare(`
            SELECT c.* FROM cards_fts f 
            JOIN cards c ON f.rowid = c.id 
            WHERE f.cards_fts MATCH ? AND c.type = ? 
            ORDER BY rank LIMIT 15
          `).all(safeQuery, type);
        } else {
          return db.prepare(`
            SELECT c.* FROM cards_fts f 
            JOIN cards c ON f.rowid = c.id 
            WHERE f.cards_fts MATCH ? 
            ORDER BY rank LIMIT 15
          `).all(safeQuery);
        }
      } catch (e) {
        console.warn("FTS query failed", e);
      }
    }
    
    return [];
  },
  findSimilarCards: async (front: string, back: string = '', type?: string, useLLM: boolean = false) => {
    if (!front && !back) return [];
    
    // We completely remove FTS (Keyword checking) based on user directive.
    // This feature is for reviewing similar semantic expressions, not keyword duplicate checking.
    const safeQuery = [front, back].filter(Boolean).join(' ').replace(/[^\w\s\u4e00-\u9fa5]/g, '').trim();
    if (!safeQuery) return [];

    let semanticResults = [];
    
    // Stage 1: Vector Search (High Recall)
    const semanticQuery = back ? `${front}: ${back}` : front;
    // Do NOT filter by type for vector search to allow cross-category synonyms
    const lanceResults = await searchCardVectors(semanticQuery, undefined, 30);
    
    const rawScoredCards: { card: any, score: number }[] = [];
    const allCards = db.prepare('SELECT * FROM cards').all() as any[];
    const cardsMap = new Map(allCards.map(c => [c.id, c]));
    
    for (const r of lanceResults) {
      const c = cardsMap.get(r.id);
      if (c) {
        let score = 1 - ((r._distance || 0) / 2);
        rawScoredCards.push({ card: c, score });
      }
    }

    rawScoredCards.sort((a, b) => b.score - a.score);
    
    const BASELINE_FLOOR = 0.60;
    let candidates = [];
    for (const item of rawScoredCards) {
      if (item.card.front.toLowerCase() === (front || '').toLowerCase()) continue;
      if (item.score >= BASELINE_FLOOR) {
        candidates.push(item.card);
      }
      if (candidates.length >= 15) break; 
    }
    
    const settings = dbHandlers.getSettings();

    // Stage 2: LLM Strict Filtering (Only if explicitly requested and key exists)
    if (useLLM && settings['aiKey'] && candidates.length > 0) {
      console.log(`[Semantic Analysis] Sending ${candidates.length} candidates to LLM for strict synonym filtering...`);
      const aiRes = await aiFilterSynonyms(front, back, candidates, settings);
      
      if (aiRes.success && aiRes.result) {
        const matchedIds = new Set(aiRes.result.map(id => parseInt(id, 10)));
        semanticResults = candidates.filter(c => matchedIds.has(c.id));
        console.log(`[Semantic Analysis] LLM returned ${semanticResults.length} strict synonyms.`);
        return semanticResults.slice(0, 10);
      } else {
        console.warn(`[Semantic Analysis] LLM filter failed: ${aiRes.error}. Returning broad candidates.`);
      }
    }

    // If useLLM is false (e.g. offline mode) or LLM failed, we can return the broad matches
    return candidates.slice(0, 10);
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

  updateCardText: async (id: number, front: string, back: string) => {
    const stmt = db.prepare(`UPDATE cards SET front = ?, back = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
    stmt.run(front, back, id)
    
    const card = dbHandlers.getCard(id) as any;
    if (card) {
      await updateCardVector(id, front, back, card.type)
    }
    
    return { success: true }
  },

  reviewCard: (id: number, isCorrect: boolean) => {
    const cardStmt = db.prepare(`SELECT * FROM cards WHERE id = ?`)
    const card = cardStmt.get(id) as any
    if (!card) return { success: false, error: 'Card not found' }

    let { repetitions, interval, easeFactor, encounterCount } = card
    const now = new Date();
    let nextReviewDate = new Date();
    
    // Save previous state for undo
    const previousState = JSON.stringify({
      repetitions,
      interval,
      easeFactor,
      nextReviewDate: card.nextReviewDate,
      encounterCount
    })

    if (repetitions < 2) {
      if (!isCorrect) {
        repetitions = 0;
        nextReviewDate = new Date(now.getTime() + 1 * 60 * 1000);
      } else {
        if (repetitions === 0) {
          repetitions = 1;
          nextReviewDate = new Date(now.getTime() + 10 * 60 * 1000);
        } else {
          repetitions = 2;
          interval = 1;
          let logicalDay = new Date(now);
          if (logicalDay.getHours() < 3) logicalDay.setDate(logicalDay.getDate() - 1);
          logicalDay.setDate(logicalDay.getDate() + 1);
          logicalDay.setHours(3, 0, 0, 0);
          nextReviewDate = logicalDay;
        }
      }
    } else {
      const settings = dbHandlers.getSettings();
      const penaltyCoef = parseFloat(settings['srsPenalty'] || '0.2')
      const rewardCoef = parseFloat(settings['srsReward'] || '2.5')

      if (!isCorrect) {
        interval = Math.max(1, interval * penaltyCoef);
        easeFactor = Math.max(1.3, easeFactor - 0.2);
      } else {
        interval = interval * rewardCoef;
      }
      let logicalDay = new Date(now);
      if (logicalDay.getHours() < 3) logicalDay.setDate(logicalDay.getDate() - 1);
      logicalDay.setDate(logicalDay.getDate() + Math.max(1, Math.round(interval)));
      logicalDay.setHours(3, 0, 0, 0);
      nextReviewDate = logicalDay;
    }

    const nextReviewIso = nextReviewDate.toISOString();
    const encounterIncrement = 1;

    const updateStmt = db.prepare(`
      UPDATE cards 
      SET repetitions = ?, interval = ?, easeFactor = ?, nextReviewDate = ?, encounterCount = encounterCount + ?, updatedAt = CURRENT_TIMESTAMP 
      WHERE id = ?
    `)
    updateStmt.run(repetitions, interval, easeFactor, nextReviewIso, encounterIncrement, id)

    // Check if reviewed today (in logical day)
    let logicalDayStart = new Date(now)
    if (logicalDayStart.getHours() < 3) {
      logicalDayStart.setDate(logicalDayStart.getDate() - 1)
    }
    logicalDayStart.setHours(3, 0, 0, 0)
    
    const checkLogStmt = db.prepare(`SELECT COUNT(*) as count FROM review_logs WHERE cardId = ? AND reviewDate >= ?`)
    const logCheck = checkLogStmt.get(id, logicalDayStart.toISOString()) as any
    const isFirstTry = logCheck.count === 0

    const logStmt = db.prepare(`
      INSERT INTO review_logs (cardId, isCorrect, isFirstTry, previousState)
      VALUES (?, ?, ?, ?)
    `)
    const logResult = logStmt.run(id, isCorrect ? 1 : 0, isFirstTry ? 1 : 0, previousState)

    return { success: true, logId: logResult.lastInsertRowid }
  },
  
  deleteCard: async (id: number) => {
    const stmt = db.prepare('DELETE FROM cards WHERE id = ?')
    stmt.run(id)
    await deleteCardVector(id)
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

  getRevisionStats: () => {
    const now = new Date()
    let logicalDayStart = new Date(now)
    if (logicalDayStart.getHours() < 3) {
      logicalDayStart.setDate(logicalDayStart.getDate() - 1)
    }
    logicalDayStart.setHours(3, 0, 0, 0)
    const logicalDayStartStr = logicalDayStart.toISOString()
    
    const allDueNow = db.prepare(`SELECT id FROM cards WHERE nextReviewDate IS NULL OR nextReviewDate <= ?`).all(now.toISOString()) as any[]
    const dueCardIds = new Set(allDueNow.map(c => c.id))
    
    const reviewedToday = db.prepare(`SELECT DISTINCT cardId FROM review_logs WHERE reviewDate >= ?`).all(logicalDayStartStr) as any[]
    const reviewedCardIds = new Set(reviewedToday.map(c => c.cardId))
    
    let memorized = 0;
    let forgotten = 0;
    let toReview = 0;
    
    reviewedCardIds.forEach(id => {
      if (!dueCardIds.has(id)) memorized++;
      else forgotten++; 
    })
    
    dueCardIds.forEach(id => {
      if (!reviewedCardIds.has(id)) toReview++;
    })
    
    return { memorized, forgotten, toReview }
  },

  undoReview: () => {
    const log = db.prepare(`SELECT * FROM review_logs ORDER BY id DESC LIMIT 1`).get() as any;
    if (!log || !log.previousState) return { success: false, error: 'No undo history found' };
    
    try {
      const prevState = JSON.parse(log.previousState);
      const updateStmt = db.prepare(`
        UPDATE cards 
        SET repetitions = ?, interval = ?, easeFactor = ?, nextReviewDate = ?, encounterCount = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      updateStmt.run(prevState.repetitions, prevState.interval, prevState.easeFactor, prevState.nextReviewDate, prevState.encounterCount, log.cardId);
      
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
    if (embeddingCache) embeddingCache.clear()
    return { success: true }
  },

  importCards: async (cards: any[]) => {
    // Note: Generating embeddings for hundreds of imported cards sequentially might take some time,
    // but it is required for pure local semantic search.
    for (const card of cards) {
      if (!card.embedding && card.front && card.back) {
        try {
          const vec = await getEmbedding(card.front + ": " + card.back);
          card.embedding = JSON.stringify(vec);
        } catch (e) {
          console.error("Embedding generation failed for imported card:", e);
        }
      }
    }

    let imported = 0
    let skipped = 0
    
    const checkStmt = db.prepare('SELECT id FROM cards WHERE front = ? AND type = ?')
    const insertStmt = db.prepare(`
      INSERT INTO cards (type, front, back, style, label, imageUrl, sourceContext, useCount, encounterCount, manualReviewCount, repetitions, interval, easeFactor, nextReviewDate, createdAt, embedding)
      VALUES (@type, @front, @back, @style, @label, @imageUrl, @sourceContext, @useCount, @encounterCount, @manualReviewCount, @repetitions, @interval, @easeFactor, @nextReviewDate, @createdAt, @embedding)
    `)
    
    const transaction = db.transaction((cardsToImport: any[]) => {
      for (const card of cardsToImport) {
        // Skip duplicates based on front and type
        const existing = checkStmt.get(card.front, card.type)
        if (existing) {
          skipped++
          continue
        }
        
        const res = insertStmt.run({
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
          createdAt: card.createdAt || new Date().toISOString(),
          embedding: card.embedding || null
        })
        imported++
        if (card.embedding) {
          try {
            // Update vector database with the new card
            addCardVector(res.lastInsertRowid as number, card.front, card.back, card.type)
              .catch(err => console.error("Failed to update vector db during import:", err))
          } catch(e) {}
        }
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
