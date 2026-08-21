import { db } from './connection'
import { searchCardVectors } from '../vector_db'
import { aiFilterSynonyms } from '../ai'
import { settingsRepo } from './settingsRepo'

export const searchService = {
  searchCards: (query: string = '', type?: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (type) {
        return db.prepare('SELECT * FROM cards WHERE type = ? ORDER BY createdAt DESC LIMIT 50').all(type);
      }
      return [];
    }
    
    // Keyword / Fuzzy string matching using SQLite FTS5 (BM25)
    const sanitized = trimmed.replace(/"/g, '""');
    const ftsSearchTerms = sanitized.split(/\s+/).filter(Boolean);
    const safeQuery = ftsSearchTerms.map(term => `"${term}"*`).join(' OR ');
    
    let ftsResults: any[] = [];
    if (safeQuery) {
      try {
        if (type) {
          ftsResults = db.prepare(`
            SELECT c.* FROM cards_fts f 
            JOIN cards c ON f.rowid = c.id 
            WHERE f.cards_fts MATCH ? AND c.type = ? 
            ORDER BY rank LIMIT 15
          `).all(safeQuery, type);
        } else {
          ftsResults = db.prepare(`
            SELECT c.* FROM cards_fts f 
            JOIN cards c ON f.rowid = c.id 
            WHERE f.cards_fts MATCH ? 
            ORDER BY rank LIMIT 15
          `).all(safeQuery);
        }
      } catch (e) {
        console.warn("FTS query failed, falling back to LIKE", e);
      }
    }
    
    if (ftsResults && ftsResults.length > 0) {
      return ftsResults;
    }

    // Fallback to LIKE substring search (e.g. for CJK or partial substrings)
    try {
      const likePattern = `%${trimmed}%`;
      if (type) {
        return db.prepare(`
          SELECT * FROM cards 
          WHERE type = ? AND (front LIKE ? OR back LIKE ? OR label LIKE ?)
          ORDER BY createdAt DESC LIMIT 15
        `).all(type, likePattern, likePattern, likePattern);
      } else {
        return db.prepare(`
          SELECT * FROM cards 
          WHERE front LIKE ? OR back LIKE ? OR label LIKE ?
          ORDER BY createdAt DESC LIMIT 15
        `).all(likePattern, likePattern, likePattern);
      }
    } catch (e) {
      console.warn("LIKE query failed", e);
      return [];
    }
  },

  findSimilarCards: async (front: string, back: string = '', type?: string, useLLM: boolean = false, context: string = '') => {
    if (!front && !back) return [];
    
    // We completely remove FTS (Keyword checking) based on user directive.
    const safeQuery = [front, back].filter(Boolean).join(' ').replace(/[^\w\s\u4e00-\u9fa5]/g, '').trim();
    if (!safeQuery) return [];

    // Stage 1: Vector Search (High Recall)
    const semanticQuery = back ? (front ? `${front}: ${back}` : back) : front;
    const lanceResults = await searchCardVectors(semanticQuery, type, 30);
    
    const rawScoredCards: { card: any, score: number }[] = [];
    const allCards = type
      ? db.prepare('SELECT * FROM cards WHERE type = ?').all(type) as any[]
      : db.prepare('SELECT * FROM cards').all() as any[];
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
    const seenIds = new Set();
    for (const item of rawScoredCards) {
      if (item.card.front.toLowerCase() === (front || '').toLowerCase()) continue;
      if (seenIds.has(item.card.id)) continue;
      if (item.score >= BASELINE_FLOOR) {
        candidates.push(item.card);
        seenIds.add(item.card.id);
      }
      if (candidates.length >= 15) break; 
    }
    
    // Stage 2: LLM Strict Filtering (for Synonyms)
    if (useLLM) {
      const settings = settingsRepo.getSettings();
      if (!settings['aiKey'] || candidates.length === 0) {
        return [];
      }

      console.log(`[Semantic Analysis] Sending ${candidates.length} candidates to LLM for strict synonym filtering...`);
      const aiRes = await aiFilterSynonyms(front, back, candidates, settings, context);
      
      if (aiRes.success && aiRes.result) {
        const matchedIds = new Set(aiRes.result.map(id => parseInt(id, 10)));
        const semanticResults = candidates.filter(c => matchedIds.has(c.id));
        console.log(`[Semantic Analysis] LLM returned ${semanticResults.length} strict synonyms.`);
        return semanticResults.slice(0, 10);
      } else {
        console.warn(`[Semantic Analysis] LLM filter failed or returned no match: ${aiRes.error}`);
        return [];
      }
    }

    return candidates.slice(0, 10);
  }
}
