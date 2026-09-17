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
  
  getCards: (type?: string) => {
    if (type) {
      return db.prepare('SELECT * FROM cards WHERE type = ? ORDER BY createdAt DESC').all(type)
    }
    return db.prepare('SELECT * FROM cards ORDER BY createdAt DESC').all()
  },
  
  getCard: (id: number) => {
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(id)
  },

  incrementUseCount: (id: number) => {
    db.prepare('UPDATE cards SET useCount = useCount + 1 WHERE id = ?').run(id)
  },

  incrementEncounterCount: (id: number) => {
    db.prepare('UPDATE cards SET encounterCount = encounterCount + 1 WHERE id = ?').run(id)
  },

  incrementManualReviewCount: (id: number) => {
    db.prepare('UPDATE cards SET manualReviewCount = manualReviewCount + 1 WHERE id = ?').run(id)
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
    try {
      db.prepare('DELETE FROM review_logs WHERE cardId = ?').run(id)
    } catch {}
    const stmt = db.prepare('DELETE FROM cards WHERE id = ?')
    stmt.run(id)
    await deleteCardVector(id)
    return { success: true }
  },

  deleteCards: async (ids: number[]) => {
    if (!ids || ids.length === 0) return { success: true }
    
    try {
      const deleteLogStmt = db.prepare('DELETE FROM review_logs WHERE cardId = ?')
      const deleteStmt = db.prepare('DELETE FROM cards WHERE id = ?')
      db.transaction(() => {
        for (const id of ids) {
          try { deleteLogStmt.run(id) } catch {}
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
  },

  getGlossaryTaxonomyCounts: () => {
    try {
      const rows = db.prepare("SELECT id, label FROM cards WHERE type = 'Glossary' AND label IS NOT NULL AND label != ''").all() as { id: number, label: string }[]
      const domainCounts: Record<string, number> = {}
      const fieldCounts: Record<string, number> = {}

      for (const row of rows) {
        const labels = row.label.split(',').map(s => s.trim()).filter(Boolean)
        const seenDomainsForCard = new Set<string>()
        const seenFieldsForCard = new Set<string>()

        for (const l of labels) {
          // Support both '/' (new standard) and '\' (legacy fallback)
          const delimiter = l.includes('/') ? '/' : (l.includes('\\') ? '\\' : null)
          if (delimiter) {
            const [domain, field] = l.split(delimiter)
            if (domain) {
              if (!seenDomainsForCard.has(domain)) {
                seenDomainsForCard.add(domain)
                domainCounts[domain] = (domainCounts[domain] || 0) + 1
              }
              const fieldKey = `${domain}/${field}`
              if (!seenFieldsForCard.has(fieldKey)) {
                seenFieldsForCard.add(fieldKey)
                fieldCounts[fieldKey] = (fieldCounts[fieldKey] || 0) + 1
              }
            }
          } else {
            if (!seenDomainsForCard.has(l)) {
              seenDomainsForCard.add(l)
              domainCounts[l] = (domainCounts[l] || 0) + 1
            }
          }
        }
      }

      return {
        success: true,
        domainCounts,
        fieldCounts,
        totalGlossaryCards: rows.length
      }
    } catch (e: any) {
      console.error('Failed to get taxonomy counts:', e)
      return { success: false, domainCounts: {}, fieldCounts: {}, totalGlossaryCards: 0, error: e.message }
    }
  },

  migrateGlossaryDomain: (payload: { oldDomain: string; action: 'rename' | 'transfer' | 'uncategorized' | 'detach'; targetDomain?: string; newDomainName?: string }) => {
    const { oldDomain, action, targetDomain, newDomainName } = payload
    try {
      const rows = db.prepare("SELECT id, label FROM cards WHERE type = 'Glossary' AND label IS NOT NULL").all() as { id: number, label: string }[]
      let affectedCount = 0

      const updateStmt = db.prepare('UPDATE cards SET label = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')

      db.transaction(() => {
        for (const row of rows) {
          if (!row.label) continue
          const labels = row.label.split(',').map(s => s.trim()).filter(Boolean)
          let modified = false

          const newLabels: (string | null)[] = labels.map(l => {
            const normalized = l.replace(/\\/g, '/')
            if (normalized === oldDomain) {
              modified = true
              if (action === 'rename' && newDomainName) return newDomainName
              if (action === 'transfer' && targetDomain) return targetDomain
              if (action === 'uncategorized') return 'General'
              if (action === 'detach') return null
            } else if (normalized.startsWith(`${oldDomain}/`)) {
              modified = true
              const field = normalized.slice(oldDomain.length + 1)
              if (action === 'rename' && newDomainName) return `${newDomainName}/${field}`
              if (action === 'transfer' && targetDomain) return `${targetDomain}/${field}`
              if (action === 'uncategorized') return `General/${field}`
              if (action === 'detach') return null
            }
            return normalized
          })

          if (modified) {
            const uniqueLabels = Array.from(new Set(newLabels.filter(Boolean))) as string[]
            const finalLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : null
            updateStmt.run(finalLabel, row.id)
            affectedCount++
          }
        }
      })()

      return { success: true, affectedCount }
    } catch (e: any) {
      console.error('Failed to migrate domain:', e)
      return { success: false, error: e.message }
    }
  },

  migrateGlossaryField: (payload: { domain: string; oldField: string; action: 'rename' | 'merge' | 'detach'; newFieldName?: string; mergeTargetField?: string }) => {
    const { domain, oldField, action, newFieldName, mergeTargetField } = payload
    const targetFullLabel = `${domain}/${oldField}`

    try {
      const rows = db.prepare("SELECT id, label FROM cards WHERE type = 'Glossary' AND label IS NOT NULL").all() as { id: number, label: string }[]
      let affectedCount = 0

      const updateStmt = db.prepare('UPDATE cards SET label = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')

      db.transaction(() => {
        for (const row of rows) {
          if (!row.label) continue
          const labels = row.label.split(',').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
          let modified = false

          const newLabels: (string | null)[] = labels.map(l => {
            if (l === targetFullLabel) {
              modified = true
              if (action === 'rename' && newFieldName) return `${domain}/${newFieldName}`
              if (action === 'merge' && mergeTargetField) return `${domain}/${mergeTargetField}`
              if (action === 'detach') return null
            }
            return l
          })

          if (modified) {
            const uniqueLabels = Array.from(new Set(newLabels.filter(Boolean))) as string[]
            const finalLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : null
            updateStmt.run(finalLabel, row.id)
            affectedCount++
          }
        }
      })()

      return { success: true, affectedCount }
    } catch (e: any) {
      console.error('Failed to migrate field:', e)
      return { success: false, error: e.message }
    }
  },

  getOrphanedGlossaryTags: (validTaxonomyTags: string[]) => {
    try {
      const validSet = new Set(validTaxonomyTags.map(t => t.toLowerCase().replace(/\\/g, '/')))
      const rows = db.prepare("SELECT id, front, label FROM cards WHERE type = 'Glossary' AND label IS NOT NULL AND label != ''").all() as { id: number, front: string, label: string }[]
      
      const orphanMap: Record<string, { count: number; sampleTerms: string[] }> = {}

      for (const row of rows) {
        const labels = row.label.split(',').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
        for (const l of labels) {
          if (!validSet.has(l.toLowerCase())) {
            if (!orphanMap[l]) {
              orphanMap[l] = { count: 0, sampleTerms: [] }
            }
            orphanMap[l].count += 1
            if (orphanMap[l].sampleTerms.length < 3) {
              const termName = row.front.split('\n')[0] || row.front
              if (!orphanMap[l].sampleTerms.includes(termName)) {
                orphanMap[l].sampleTerms.push(termName)
              }
            }
          }
        }
      }

      return {
        success: true,
        orphans: orphanMap,
        totalOrphanCards: Object.values(orphanMap).reduce((sum, item) => sum + item.count, 0)
      }
    } catch (e: any) {
      console.error('Failed to get orphaned tags:', e)
      return { success: false, orphans: {}, totalOrphanCards: 0, error: e.message }
    }
  },

  batchMigrateGlossaryTags: (mappings: Record<string, string | null>) => {
    try {
      const rows = db.prepare("SELECT id, label FROM cards WHERE type = 'Glossary' AND label IS NOT NULL").all() as { id: number, label: string }[]
      let affectedCount = 0
      const updateStmt = db.prepare('UPDATE cards SET label = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')

      // Normalize mappings keys and values
      const normalizedMappings: Record<string, string | null> = {}
      for (const [k, v] of Object.entries(mappings)) {
        normalizedMappings[k.replace(/\\/g, '/')] = v ? v.replace(/\\/g, '/') : null
      }

      db.transaction(() => {
        for (const row of rows) {
          if (!row.label) continue
          const labels = row.label.split(',').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
          let modified = false

          const newLabels: (string | null)[] = labels.map(l => {
            // 1. Exact match
            if (normalizedMappings[l] !== undefined) {
              modified = true
              return normalizedMappings[l]
            }
            // 2. Domain prefix match e.g. "Economics and Finance/Macroeconomics" -> "Finance & Economics/Macroeconomics"
            if (l.includes('/')) {
              const [dom, fld] = l.split('/')
              if (normalizedMappings[dom] !== undefined) {
                modified = true
                const targetDom = normalizedMappings[dom]
                return targetDom ? `${targetDom}/${fld}` : null
              }
            }
            return l
          })

          if (modified) {
            const uniqueLabels = Array.from(new Set(newLabels.filter(Boolean))) as string[]
            const finalLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : null
            updateStmt.run(finalLabel, row.id)
            affectedCount++
          }
        }
      })()

      return { success: true, affectedCount }
    } catch (e: any) {
      console.error('Failed to batch migrate tags:', e)
      return { success: false, error: e.message }
    }
  }
}
