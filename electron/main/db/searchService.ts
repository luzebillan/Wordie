import { db } from './connection'
import { searchCardVectors } from '../vector_db'
import { aiFilterSynonyms } from '../ai'
import { settingsRepo } from './settingsRepo'
import { projectCJK } from './init'

export function buildFtsQuery(query: string): string {
  const cleanTerms = query.replace(/["*^:()]/g, ' ').split(/\s+/).filter(Boolean);
  if (cleanTerms.length === 0) return '';

  return cleanTerms.map(term => {
    const safeTerm = term.replace(/"/g, '');
    const hasCJK = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/.test(safeTerm);
    if (hasCJK) {
      const projected = projectCJK(safeTerm);
      return `"${projected}"`;
    } else {
      return `"${safeTerm}"*`;
    }
  }).join(' OR ');
}

export const searchService = {
  searchCards: (query: string = '', type?: string, limit?: number) => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (type) {
        const sql = limit && limit > 0
          ? 'SELECT * FROM cards WHERE type = ? ORDER BY createdAt DESC LIMIT ?'
          : 'SELECT * FROM cards WHERE type = ? ORDER BY createdAt DESC LIMIT 50';
        return limit && limit > 0
          ? db.prepare(sql).all(type, limit)
          : db.prepare(sql).all(type);
      }
      return [];
    }

    const cleanTerms = trimmed.replace(/["*^:()]/g, ' ').split(/\s+/).filter(Boolean);
    if (cleanTerms.length === 0) return [];

    const ftsQuery = buildFtsQuery(trimmed);
    const ftsRankMap = new Map<number, number>();
    const matchedCardsMap = new Map<number, any>();

    const recallLimit = limit && limit > 0 ? Math.max(limit * 3, 50) : 500;

    // 1. FTS5 Lexical Search (with CJK unigram projection)
    if (ftsQuery) {
      try {
        const ftsRows = type
          ? db.prepare(`
              SELECT c.*, f.rank FROM cards_fts f 
              JOIN cards c ON f.rowid = c.id 
              WHERE f.cards_fts MATCH ? AND c.type = ? 
              ORDER BY rank LIMIT ?
            `).all(ftsQuery, type, recallLimit) as any[]
          : db.prepare(`
              SELECT c.*, f.rank FROM cards_fts f 
              JOIN cards c ON f.rowid = c.id 
              WHERE f.cards_fts MATCH ? 
              ORDER BY rank LIMIT ?
            `).all(ftsQuery, recallLimit) as any[];

        for (const row of ftsRows) {
          const { rank, ...card } = row;
          matchedCardsMap.set(card.id, card);
          ftsRankMap.set(card.id, rank);
        }
      } catch (e) {
        console.warn("FTS query failed, relying on LIKE fallback", e);
      }
    }

    // 2. SQL LIKE Substring Search fallback (only if FTS returned 0 results or failed)
    if (matchedCardsMap.size === 0) {
      try {
        const escapedLike = trimmed.replace(/[%_\\]/g, '\\$&');
        const likePattern = `%${escapedLike}%`;
        const likeRows = type
          ? db.prepare(`
              SELECT * FROM cards 
              WHERE type = ? AND (
                front LIKE ? ESCAPE '\\' OR 
                back LIKE ? ESCAPE '\\' OR 
                label LIKE ? ESCAPE '\\' OR 
                style LIKE ? ESCAPE '\\' OR 
                sourceContext LIKE ? ESCAPE '\\'
              )
              ORDER BY createdAt DESC LIMIT ?
            `).all(type, likePattern, likePattern, likePattern, likePattern, likePattern, recallLimit) as any[]
          : db.prepare(`
              SELECT * FROM cards 
              WHERE front LIKE ? ESCAPE '\\' OR 
                    back LIKE ? ESCAPE '\\' OR 
                    label LIKE ? ESCAPE '\\' OR 
                    style LIKE ? ESCAPE '\\' OR 
                    sourceContext LIKE ? ESCAPE '\\'
              ORDER BY createdAt DESC LIMIT ?
            `).all(likePattern, likePattern, likePattern, likePattern, likePattern, recallLimit) as any[];

        for (const card of likeRows) {
          if (!matchedCardsMap.has(card.id)) {
            matchedCardsMap.set(card.id, card);
          }
        }
      } catch (e) {
        console.warn("LIKE fallback failed", e);
      }
    }

    // 3. Multi-level Deterministic Relevance Ranking
    const qLower = trimmed.toLowerCase();
    const tokensLower = cleanTerms.map(t => t.toLowerCase());

    const scoredCards = Array.from(matchedCardsMap.values()).map(card => {
      let score = 0;
      const frontLower = (card.front || '').toLowerCase();
      const backLower = (card.back || '').toLowerCase();
      const labelLower = (card.label || '').toLowerCase();
      const styleLower = (card.style || '').toLowerCase();
      const contextLower = (card.sourceContext || '').toLowerCase();

      // Front exact match
      if (frontLower === qLower) {
        score += 1000;
      } else if (frontLower.startsWith(qLower)) {
        score += 500;
      } else if (frontLower.includes(qLower)) {
        score += 250;
      }

      // Label & Style matches
      if (labelLower === qLower || styleLower === qLower) {
        score += 150;
      } else if (labelLower.includes(qLower) || styleLower.includes(qLower)) {
        score += 80;
      }

      // Back & Context matches
      if (backLower.includes(qLower)) {
        score += 60;
      }
      if (contextLower.includes(qLower)) {
        score += 30;
      }

      // Multi-token hits
      let frontTokensHit = 0;
      let backTokensHit = 0;
      for (const t of tokensLower) {
        if (frontLower.includes(t)) frontTokensHit++;
        if (backLower.includes(t)) backTokensHit++;
      }
      score += frontTokensHit * 40;
      score += backTokensHit * 15;

      // FTS Rank bonus if present
      const ftsRank = ftsRankMap.get(card.id);
      if (ftsRank !== undefined) {
        score += Math.max(0, 10 - Math.abs(ftsRank) * 0.1);
      }

      return { card, score };
    });

    scoredCards.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (b.card.id || 0) - (a.card.id || 0);
    });

    const results = scoredCards.map(item => item.card);
    if (limit && limit > 0) {
      return results.slice(0, limit);
    }
    return results;
  },

  searchVectorCards: async (queryText: string, type?: string, limit: number = 25) => {
    if (!queryText || !queryText.trim()) return [];
    try {
      const lanceResults = await searchCardVectors(queryText.trim(), type, limit);
      if (!lanceResults || lanceResults.length === 0) return [];

      const candidateIds = lanceResults.map(r => r.id).filter(id => typeof id === 'number');
      if (candidateIds.length === 0) return [];

      const placeholders = candidateIds.map(() => '?').join(',');
      const matchedCards = (type
        ? db.prepare(`SELECT * FROM cards WHERE id IN (${placeholders}) AND type = ?`).all(...candidateIds, type)
        : db.prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`).all(...candidateIds)) as any[];
      const cardsMap = new Map(matchedCards.map(c => [c.id, c]));

      const ordered: any[] = [];
      for (const r of lanceResults) {
        const card = cardsMap.get(r.id);
        if (card && !ordered.some(c => c.id === card.id)) {
          ordered.push(card);
        }
      }
      return ordered.slice(0, limit);
    } catch (e) {
      console.error("[searchVectorCards] Failed:", e);
      return [];
    }
  },

  findSimilarCards: async (
    front: string,
    back: string = '',
    type?: string,
    useLLM: boolean = false,
    context: string = '',
    options?: { minScore?: number; limit?: number }
  ) => {
    if (!front && !back) return [];
    
    // We completely remove FTS (Keyword checking) based on user directive.
    const safeQuery = [front, back].filter(Boolean).join(' ').replace(/[^\w\s\u4e00-\u9fa5]/g, '').trim();
    if (!safeQuery) return [];

    const queryLimit = options?.limit ? Math.max(options.limit * 2, 30) : 30;

    // Stage 1: Vector Search (High Recall)
    const semanticQuery = back ? (front ? `${front}: ${back}` : back) : front;
    const lanceResults = await searchCardVectors(semanticQuery, type, queryLimit);
    if (!lanceResults || lanceResults.length === 0) return [];
    
    const candidateIds = lanceResults.map(r => r.id).filter(id => typeof id === 'number');
    if (candidateIds.length === 0) return [];

    const placeholders = candidateIds.map(() => '?').join(',');
    const matchedCards = (type
      ? db.prepare(`SELECT * FROM cards WHERE id IN (${placeholders}) AND type = ?`).all(...candidateIds, type)
      : db.prepare(`SELECT * FROM cards WHERE id IN (${placeholders})`).all(...candidateIds)) as any[];
    const cardsMap = new Map(matchedCards.map(c => [c.id, c]));
    
    const rawScoredCards: { card: any, score: number }[] = [];
    for (const r of lanceResults) {
      const c = cardsMap.get(r.id);
      if (c) {
        let score = 1 - ((r._distance || 0) / 2);
        rawScoredCards.push({ card: c, score });
      }
    }

    rawScoredCards.sort((a, b) => b.score - a.score);
    
    const BASELINE_FLOOR = options?.minScore !== undefined ? options.minScore : 0.60;
    const maxCandidates = options?.limit !== undefined ? options.limit : 15;
    let candidates = [];
    const seenIds = new Set();
    for (const item of rawScoredCards) {
      if (item.card.front.toLowerCase() === (front || '').toLowerCase()) continue;
      if (seenIds.has(item.card.id)) continue;
      if (item.score >= BASELINE_FLOOR) {
        candidates.push(item.card);
        seenIds.add(item.card.id);
      }
      if (candidates.length >= maxCandidates) break; 
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

    return candidates.slice(0, options?.limit !== undefined ? options.limit : 10);
  }
}
