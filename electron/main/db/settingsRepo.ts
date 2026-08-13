import { db } from './connection'
import { clearVectorTable, addCardVectorsBatch } from '../vector_db'
import { getEmbedding } from '../semantic'

export const settingsRepo = {
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

  clearDatabase: async () => {
    try {
      db.transaction(() => {
        db.exec('DELETE FROM review_logs')
        db.exec('DELETE FROM cards')
        // Reset sqlite sequence for auto-increment IDs
        try {
          db.exec("DELETE FROM sqlite_sequence WHERE name='cards' OR name='review_logs'")
        } catch (e) {
          // Ignore error if sqlite_sequence does not exist
        }
      })()
      await clearVectorTable()
      return { success: true }
    } catch (e: any) {
      console.error('Failed to clear database:', e)
      return { success: false, error: e.message }
    }
  },

  importCards: async (cards: any[]) => {
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
    let vectorsToBatch: { id: number, front: string, type: string, vector: number[] }[] = []
    
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
            const vectorArray = typeof card.embedding === 'string' ? JSON.parse(card.embedding) : card.embedding
            vectorsToBatch.push({
              id: res.lastInsertRowid as number,
              front: card.front,
              type: card.type,
              vector: vectorArray
            })
          } catch(e) {}
        }
      }
    })
    
    try {
      transaction(cards)
      if (vectorsToBatch.length > 0) {
        await addCardVectorsBatch(vectorsToBatch)
      }
      return { success: true, imported, skipped }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
}
