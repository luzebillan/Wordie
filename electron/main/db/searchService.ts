import { db } from './connection'
import { searchCardVectors } from '../vector_db'
import { aiFilterSynonyms } from '../ai'
import { settingsRepo } from './settingsRepo'

export const searchService = {
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
    const safeQuery = [front, back].filter(Boolean).join(' ').replace(/[^\w\s\u4e00-\u9fa5]/g, '').trim();
    if (!safeQuery) return [];

    let semanticResults = [];
    
    // Stage 1: Vector Search (High Recall)
    const semanticQuery = back ? (front ? `${front}: ${back}` : back) : front;
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
    
    const settings = settingsRepo.getSettings();

    // Stage 2: LLM Strict Filtering
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

    return candidates.slice(0, 10);
  }
}
