import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { projectCJK } from '../electron/main/db/init'
import { buildFtsQuery } from '../electron/main/db/searchService'

describe('CJK Unigram Projection & FTS Query Builder', () => {
  describe('projectCJK', () => {
    it('returns empty string for empty or null inputs', () => {
      expect(projectCJK('')).toBe('')
      expect(projectCJK(null)).toBe('')
      expect(projectCJK(undefined)).toBe('')
    })

    it('preserves non-CJK words without extra spaces', () => {
      expect(projectCJK('apple')).toBe('apple')
      expect(projectCJK('deep learning in NLP')).toBe('deep learning in NLP')
    })

    it('inserts spaces around each CJK character', () => {
      expect(projectCJK('人工智能')).toBe('人 工 智 能')
      expect(projectCJK('自然语言处理')).toBe('自 然 语 言 处 理')
    })

    it('handles mixed English and CJK text', () => {
      expect(projectCJK('NLP自然语言处理')).toBe('NLP 自 然 语 言 处 理')
      expect(projectCJK('学习 AI 很有用')).toBe('学 习 AI 很 有 用')
    })

    it('normalizes multiple spaces cleanly', () => {
      expect(projectCJK('  自然   语言  ')).toBe('自 然 语 言')
    })
  })

  describe('buildFtsQuery', () => {
    it('returns empty string for blank queries', () => {
      expect(buildFtsQuery('')).toBe('')
      expect(buildFtsQuery('   ')).toBe('')
    })

    it('creates prefix match for English words', () => {
      expect(buildFtsQuery('apple')).toBe('"apple"*')
      expect(buildFtsQuery('take off')).toBe('"take"* OR "off"*')
    })

    it('creates phrase match with unigrams for CJK terms', () => {
      expect(buildFtsQuery('语言')).toBe('"语 言"')
      expect(buildFtsQuery('人工智能')).toBe('"人 工 智 能"')
    })

    it('handles mixed CJK and English query terms', () => {
      const q = buildFtsQuery('NLP 语言')
      expect(q).toBe('"NLP"* OR "语 言"')
    })
  })

  describe('SQLite FTS5 CJK Infix Search & Triggers', () => {
    let testDb: InstanceType<typeof Database>

    beforeEach(() => {
      testDb = new Database(':memory:')
      testDb.function('cjk_unigram', (str: any) => projectCJK(str))

      testDb.exec(`
        CREATE TABLE cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          front TEXT,
          back TEXT,
          label TEXT,
          style TEXT,
          sourceContext TEXT
        );

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
      `)
    })

    it('matches CJK middle substring (infix) without full table LIKE scan', () => {
      testDb.prepare(`
        INSERT INTO cards (front, back, label, style, sourceContext) 
        VALUES (?, ?, ?, ?, ?)
      `).run('自然语言处理', 'Natural Language Processing (NLP)', 'Tech', 'Formal', 'Deep learning in NLP')

      const ftsQuery = buildFtsQuery('语言')
      const rows = testDb.prepare(`
        SELECT c.* FROM cards_fts f 
        JOIN cards c ON f.rowid = c.id 
        WHERE f.cards_fts MATCH ?
      `).all(ftsQuery) as any[]

      expect(rows).toHaveLength(1)
      expect(rows[0].front).toBe('自然语言处理')
    })

    it('matches English prefix and phrase queries', () => {
      testDb.prepare(`
        INSERT INTO cards (front, back, label, style, sourceContext) 
        VALUES (?, ?, ?, ?, ?)
      `).run('take it easy', 'To relax and not worry', 'Idiom', 'Informal', '')

      const ftsQuery = buildFtsQuery('take')
      const rows = testDb.prepare(`
        SELECT c.* FROM cards_fts f 
        JOIN cards c ON f.rowid = c.id 
        WHERE f.cards_fts MATCH ?
      `).all(ftsQuery) as any[]

      expect(rows).toHaveLength(1)
      expect(rows[0].front).toBe('take it easy')
    })

    it('updates FTS index when cards are updated', () => {
      const res = testDb.prepare(`
        INSERT INTO cards (front, back, label, style, sourceContext) 
        VALUES (?, ?, ?, ?, ?)
      `).run('旧文本', 'Old text', 'General', 'Normal', '')

      testDb.prepare(`UPDATE cards SET front = '全新自然语言' WHERE id = ?`).run(res.lastInsertRowid)

      // Old text no longer matches
      const oldQuery = buildFtsQuery('旧文本')
      const oldRows = testDb.prepare(`SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?`).all(oldQuery)
      expect(oldRows).toHaveLength(0)

      // New text matches infix
      const newQuery = buildFtsQuery('自然语言')
      const newRows = testDb.prepare(`SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?`).all(newQuery)
      expect(newRows).toHaveLength(1)
      expect(newRows[0].rowid).toBe(Number(res.lastInsertRowid))
    })

    it('cleans up FTS index when cards are deleted', () => {
      const res = testDb.prepare(`
        INSERT INTO cards (front, back, label, style, sourceContext) 
        VALUES (?, ?, ?, ?, ?)
      `).run('将被删除', 'To be deleted', 'Test', 'Normal', '')

      const queryBefore = buildFtsQuery('删除')
      expect(testDb.prepare(`SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?`).all(queryBefore)).toHaveLength(1)

      testDb.prepare(`DELETE FROM cards WHERE id = ?`).run(res.lastInsertRowid)

      expect(testDb.prepare(`SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?`).all(queryBefore)).toHaveLength(0)
    })

    it('handles queries with punctuation and symbols gracefully', () => {
      testDb.prepare(`
        INSERT INTO cards (front, back, label, style, sourceContext) 
        VALUES (?, ?, ?, ?, ?)
      `).run('C++ programming', 'A compiled programming language', 'Dev', 'Formal', 'Used in high performance apps')

      const symbols = ['-', '+', '*', '(', ')', ':', '^', '{', '}', '"', 'C++', 'C/C++', '{test}', 'test:foo', 'AND', 'NOT', 'OR', 'NEAR/2', '"quoted"']
      for (const sym of symbols) {
        const q = buildFtsQuery(sym)
        if (q) {
          expect(() => {
            testDb.prepare(`SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?`).all(q)
          }).not.toThrow()
        }
      }
    })
  })
})
