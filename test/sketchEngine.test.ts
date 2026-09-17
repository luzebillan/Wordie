import { describe, it, expect } from 'vitest'
import { formatSketchEnginePhrase } from '../electron/main/ai'

describe('formatSketchEnginePhrase', () => {
  it('does NOT remove one\'s from anyone\'s or anyone’s', () => {
    const res1 = formatSketchEnginePhrase("anyone's guess")
    expect(res1.cleanPhrase).toBe("anyone's guess")
    expect(res1.searchWords).toContain("anyone's")

    const res2 = formatSketchEnginePhrase("anyone’s guess")
    expect(res2.cleanPhrase).toBe("anyone's guess")
    expect(res2.searchWords).toContain("anyone's")
  })

  it('correctly replaces one\'s and one’s with wildcard asterisk in idioms', () => {
    const res1 = formatSketchEnginePhrase("at one's disposal")
    expect(res1.cleanPhrase).toBe("at*disposal")
    expect(res1.cqlTokens).toEqual(['[lemma_lc="at"]', '[]{1,2}', '[lemma_lc="disposal"]'])

    const res2 = formatSketchEnginePhrase("in one’s element")
    expect(res2.cleanPhrase).toBe("in*element")
  })

  it('correctly replaces other placeholders like sb., sth., someone, be', () => {
    const res = formatSketchEnginePhrase("be full of sb.")
    expect(res.cleanPhrase).toBe("*full of*")
    expect(res.cqlTokens).toContain('[lemma_lc="full"]')
    expect(res.cqlTokens).toContain('[lemma_lc="of"]')
  })

  it('uses word search ([word="(?i)..."]) for words ending with aught', () => {
    const resCaught = formatSketchEnginePhrase("caught red-handed")
    expect(resCaught.cqlTokens).toContain('[word="(?i)caught"]')

    const resTaught = formatSketchEnginePhrase("taught a lesson")
    expect(resTaught.cqlTokens).toContain('[word="(?i)taught"]')

    const resFraught = formatSketchEnginePhrase("fraught with danger")
    expect(resFraught.cqlTokens).toContain('[word="(?i)fraught"]')
  })

  it('uses word search for other designated inflections and suffixes', () => {
    const res = formatSketchEnginePhrase("broken dreams and thought processes")
    expect(res.cqlTokens).toContain('[word="(?i)broken"]') // ends with 'en'
    expect(res.cqlTokens).toContain('[word="(?i)dreams"]') // ends with 's'
    expect(res.cqlTokens).toContain('[word="(?i)thought"]') // ends with 'ought'
    expect(res.cqlTokens).toContain('[word="(?i)processes"]') // ends with 'es'
  })

  it('uses lemma search for standard base form words', () => {
    const res = formatSketchEnginePhrase("catch the ball")
    expect(res.cqlTokens).toContain('[lemma_lc="catch"]')
    expect(res.cqlTokens).toContain('[lemma_lc="the"]')
    expect(res.cqlTokens).toContain('[lemma_lc="ball"]')
  })
})
