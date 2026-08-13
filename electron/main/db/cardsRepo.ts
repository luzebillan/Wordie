import { db } from './connection'
import { addCardVector, updateCardVector, deleteCardVector } from '../vector_db'

export const cardsRepo = {
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

  incrementUseCount: (id: number) => {
    db.exec(`UPDATE cards SET useCount = useCount + 1 WHERE id = ${id}`)
  },

  incrementEncounterCount: (id: number) => {
    db.exec(`UPDATE cards SET encounterCount = encounterCount + 1 WHERE id = ${id}`)
  },

  incrementManualReviewCount: (id: number) => {
    db.exec(`UPDATE cards SET manualReviewCount = manualReviewCount + 1 WHERE id = ${id}`)
  },

  updateCardText: async (id: number, front: string, back: string) => {
    const stmt = db.prepare(`UPDATE cards SET front = ?, back = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
    stmt.run(front, back, id)
    
    const card = cardsRepo.getCard(id) as any;
    if (card) {
      await updateCardVector(id, front, back, card.type)
    }
    
    return { success: true }
  },

  updateCard: async (id: number, updates: any) => {
    const fields = ['front', 'back', 'type', 'style', 'label', 'imageUrl', 'sourceContext']
    const setClauses: string[] = []
    const values: any[] = []
    
    for (const field of fields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`)
        values.push(updates[field])
      }
    }
    
    if (setClauses.length === 0) return { success: true }
    
    setClauses.push('updatedAt = CURRENT_TIMESTAMP')
    values.push(id)
    
    const stmt = db.prepare(`UPDATE cards SET ${setClauses.join(', ')} WHERE id = ?`)
    stmt.run(...values)
    
    if (updates.front !== undefined || updates.back !== undefined || updates.type !== undefined) {
      const card = cardsRepo.getCard(id) as any;
      if (card) {
        await updateCardVector(id, card.front, card.back, card.type)
      }
    }
    
    return { success: true }
  },

  deleteCard: async (id: number) => {
    const stmt = db.prepare('DELETE FROM cards WHERE id = ?')
    stmt.run(id)
    await deleteCardVector(id)
    return { success: true }
  },

  deleteCards: async (ids: number[]) => {
    if (!ids || ids.length === 0) return { success: true }
    
    try {
      const deleteStmt = db.prepare('DELETE FROM cards WHERE id = ?')
      db.transaction(() => {
        for (const id of ids) {
          deleteStmt.run(id)
        }
      })()
      
      // Also delete from vector DB
      for (const id of ids) {
        await deleteCardVector(id)
      }
      return { success: true }
    } catch (e: any) {
      console.error('Failed to bulk delete cards:', e)
      return { success: false, error: e.message }
    }
  }
}
