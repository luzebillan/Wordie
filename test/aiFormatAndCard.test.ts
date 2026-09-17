import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import {
  parseGlossaryResponse,
  cleanGlossaryLine,
  escapeUnescapedControlCharsInJson,
  extractGlossaryFieldsFromText,
  cleanAiExpression,
  extractJsonObject,
  extractJsonObjects,
  alignTermWithUserTerm,
  isFullyWrappedInQuotes,
  stripWrappingQuotes,
  extractJsonArray
} from '../electron/main/ai'

describe('parseGlossaryResponse & Glossary AI formatting (Image 1 fix)', () => {
  it('successfully parses and cleans the exact multiline unescaped response from Image 1', () => {
    // Simulating the actual LLM output from Image 1 where lines were wrapped and indented
    const image1RawOutput = `{
  "term_en": "K\\nash Patel",
  "term_cn": "卡什·帕特尔",
  "def_en": "
  An American attorney and former government official who held key national security and defense roles in
  the first Trump administration, known as a prominent political ally and loyalist of Donald Trump.",
  "def_cn": "美国律师及前政府官员，曾在第一
  届特朗普政府期间担任国家安全和国防领域的多项要职，被广泛视为唐纳德·特朗普的核心
  政治盟友与忠实支持者。"
}`

    const parsed = parseGlossaryResponse(image1RawOutput, 'Kash Patel')
    expect(parsed).not.toBeNull()
    expect(parsed!.front).toBe('卡什·帕特尔\nKash Patel')
    expect(parsed!.back).toContain('曾在第一届特朗普政府期间')
    expect(parsed!.back).toContain('核心政治盟友与忠实支持者。')
    expect(parsed!.back).toContain('An American attorney and former government official who held key national security and defense roles in the first Trump administration')
    // Ensure no linebreaks inside front or back parts (front has 2 lines, back has 2 lines)
    expect(parsed!.front.split('\n').length).toBe(2)
    expect(parsed!.back.split('\n').length).toBe(2)
  })

  it('parses standard valid JSON without issues', () => {
    const raw = JSON.stringify({
      term_cn: '无党派',
      term_en: 'Non-partisan',
      def_cn: '不偏向任何政党的立场',
      def_en: 'Not biased toward any particular political party'
    })
    const parsed = parseGlossaryResponse(raw, 'Non-partisan')
    expect(parsed).toEqual({
      front: '无党派\nNon-partisan',
      back: '不偏向任何政党的立场\nNot biased toward any particular political party'
    })
  })

  it('parses markdown code-fenced JSON with trailing commas', () => {
    const raw = '```json\n{\n  "term_cn": "国会",\n  "term_en": "Congress",\n  "def_cn": "立法机构",\n  "def_en": "The national legislative body.",\n}\n```'
    const parsed = parseGlossaryResponse(raw, 'Congress')
    expect(parsed).toEqual({
      front: '国会\nCongress',
      back: '立法机构\nThe national legislative body.'
    })
  })

  it('extracts JSON surrounded by conversational text without markdown blocks', () => {
    const raw = 'Here is the glossary entry you requested:\n{\n  "term_cn": "参议院",\n  "term_en": "Senate",\n  "def_cn": "美国国会上议院",\n  "def_en": "The upper chamber of Congress."\n}\nHope this helps!'
    const parsed = parseGlossaryResponse(raw, 'Senate')
    expect(parsed).toEqual({
      front: '参议院\nSenate',
      back: '美国国会上议院\nThe upper chamber of Congress.'
    })
  })

  it('falls back to regex field extraction for severely malformed JSON', () => {
    const malformed = `
    Some preamble text
    "term_cn": "众议院",
    "term_en": "House of Representatives",
    "def_cn": "美国国会下议院",
    "def_en": "The lower chamber of Congress."
    `
    const parsed = parseGlossaryResponse(malformed, 'House of Representatives')
    expect(parsed).toEqual({
      front: '众议院\nHouse of Representatives',
      back: '美国国会下议院\nThe lower chamber of Congress.'
    })
  })

  it('parses markdown key-value format without JSON brackets or quotes', () => {
    const markdown = `
    **term_en**: Kash Patel
    **term_cn**: 卡什·帕特尔
    **def_en**: An American attorney and former government official.
    **def_cn**: 美国律师及前政府官员。
    `
    const parsed = parseGlossaryResponse(markdown, 'Kash Patel')
    expect(parsed).toEqual({
      front: '卡什·帕特尔\nKash Patel',
      back: '美国律师及前政府官员。\nAn American attorney and former government official.'
    })
  })

  it('handles unescaped interior double quotes without truncating the field value', () => {
    const rawWithInnerQuotes = `{
      "term_en": "Kash Patel",
      "term_cn": "卡什·帕特尔",
      "def_en": "He authoritatively authored the book "Plot Against the President" and testified before Congress.",
      "def_cn": "他被广泛称作"忠诚卫士"，在国家安全和国防领域任职。"
    }`
    const parsed = parseGlossaryResponse(rawWithInnerQuotes, 'Kash Patel')
    expect(parsed).not.toBeNull()
    expect(parsed!.back).toContain('Plot Against the President')
    expect(parsed!.back).toContain('testified before Congress.')
    expect(parsed!.back).toContain('忠诚卫士')
    expect(parsed!.back).toContain('在国家安全和国防领域任职。')
  })

  it('restores userTerm for Chinese input when model output has formatting or whitespace artifacts', () => {
    const raw = `{
      "term_cn": "卡 什 · 帕 特 尔",
      "term_en": "Kash Patel",
      "def_cn": "美国律师及前官员",
      "def_en": "American attorney"
    }`
    const parsed = parseGlossaryResponse(raw, '卡什·帕特尔')
    expect(parsed).not.toBeNull()
    expect(parsed!.front).toBe('卡什·帕特尔\nKash Patel')
  })

  it('cleanGlossaryLine properly repairs CJK broken lines, horizontal spaces between Hanzi, and English hyphenations', () => {
    const cjk = '曾在第一\n  届特朗普政府期间担任国家安全和国防领域的多项要职，被广泛视为唐纳德·特朗普的核心 政治盟友与忠实支持者。'
    expect(cleanGlossaryLine(cjk, false)).toBe('曾在第一届特朗普政府期间担任国家安全和国防领域的多项要职，被广泛视为唐纳德·特朗普的核心政治盟友与忠实支持者。')

    const eng = 'key national security and defense roles in\n  the first Trump adminis-\n  tration'
    expect(cleanGlossaryLine(eng, true)).toBe('key national security and defense roles in the first Trump administration')

    const cjkPunct = '速冻便当 。 （ 微波炉 ）'
    expect(cleanGlossaryLine(cjkPunct, false)).toBe('速冻便当。（微波炉）')
  })

  it('cleanGlossaryLine joins consecutive CJK characters separated by spaces without missing alternates', () => {
    const raw = '卡 什 帕 特 尔'
    expect(cleanGlossaryLine(raw, false)).toBe('卡什帕特尔')

    const longSequence = '一 二 三 四 五 六 七 八'
    expect(cleanGlossaryLine(longSequence, false)).toBe('一二三四五六七八')
  })

  it('parseGlossaryResponse falls back gracefully when only English or Chinese definition is provided', () => {
    const raw = JSON.stringify({
      term_cn: '无党派',
      term_en: '',
      def_cn: '不偏向任何政党',
      def_en: ''
    })
    const parsed = parseGlossaryResponse(raw)
    expect(parsed).toEqual({
      front: '无党派\n无党派',
      back: '不偏向任何政党\n不偏向任何政党'
    })
  })
})

describe('cleanAiExpression & Useful Expressions formatting (Image 2 fix)', () => {
  it('removes orphaned period on a new line (exact Image 2 case)', () => {
    const raw = 'To force the rapid acceptance or passage of a law, proposal, or measure, typically despite opposition or without adequate debate\n.'
    const cleaned = cleanAiExpression(raw)
    expect(cleaned).toBe('To force the rapid acceptance or passage of a law, proposal, or measure, typically despite opposition or without adequate debate.')
  })

  it('handles multiple newlines and spaces before trailing period', () => {
    const raw = 'To force the rapid acceptance or passage of a law, proposal, or measure, typically despite opposition or without adequate debate\n\n   .'
    const cleaned = cleanAiExpression(raw)
    expect(cleaned).toBe('To force the rapid acceptance or passage of a law, proposal, or measure, typically despite opposition or without adequate debate.')
  })

  it('strips quotes even when orphaned trailing period is outside or inside quotes', () => {
    const rawOutside = '"To force the rapid acceptance of a law."\n.'
    expect(cleanAiExpression(rawOutside)).toBe('To force the rapid acceptance of a law.')

    const rawInside = '"To force the rapid acceptance of a law\n."'
    expect(cleanAiExpression(rawInside)).toBe('To force the rapid acceptance of a law.')

    const rawLoneQuote = '"To force the rapid acceptance of a law.'
    expect(cleanAiExpression(rawLoneQuote)).toBe('To force the rapid acceptance of a law.')
  })

  it('collapses multiline soft-wrapped definitions into a clean single line', () => {
    const raw = 'To force the rapid acceptance\nor passage of a law,\nproposal, or measure,\ntypically despite opposition.'
    expect(cleanAiExpression(raw)).toBe('To force the rapid acceptance or passage of a law, proposal, or measure, typically despite opposition.')
  })

  it('removes horizontal spaces preceding punctuation marks', () => {
    const raw = 'To force the rapid acceptance or passage of a law , proposal , or measure . Typically despite opposition .'
    const cleaned = cleanAiExpression(raw)
    expect(cleaned).toBe('To force the rapid acceptance or passage of a law, proposal, or measure. Typically despite opposition.')
  })

  it('strips boilerplate prefixes like Definition:, Meaning:, Translation:', () => {
    const raw1 = 'Definition: To force the rapid acceptance or passage of a law.'
    expect(cleanAiExpression(raw1)).toBe('To force the rapid acceptance or passage of a law.')

    const raw2 = 'Meaning: To make decisions.'
    expect(cleanAiExpression(raw2)).toBe('To make decisions.')

    const raw3 = 'Translation: nuke'
    expect(cleanAiExpression(raw3)).toBe('nuke')
  })

  it('strips surrounding quotes and markdown code blocks', () => {
    const raw = '```\n"To force the rapid acceptance or passage of a law."\n```'
    const cleaned = cleanAiExpression(raw)
    expect(cleaned).toBe('To force the rapid acceptance or passage of a law.')
  })

  it('strips leading bullets and removes orphan punctuation lines', () => {
    const raw = '- An action performed quickly.\n.\n'
    const cleaned = cleanAiExpression(raw)
    expect(cleaned).toBe('An action performed quickly.')
  })

  it('preserves multi-sentence definitions and standard ellipsis', () => {
    const raw = 'First sentence of definition. Second sentence of definition...'
    const cleaned = cleanAiExpression(raw)
    expect(cleaned).toBe('First sentence of definition. Second sentence of definition...')
  })

  it('handles question marks, exclamation marks, and Chinese punctuation orphaned by newlines', () => {
    const raw1 = 'Is this really the truth\n?'
    expect(cleanAiExpression(raw1)).toBe('Is this really the truth?')

    const raw2 = 'That was amazing\n!'
    expect(cleanAiExpression(raw2)).toBe('That was amazing!')

    const raw3 = '这是一个重要的表达\n。'
    expect(cleanAiExpression(raw3)).toBe('这是一个重要的表达。')
  })

  it('handles empty or whitespace-only inputs gracefully', () => {
    expect(cleanAiExpression('')).toBe('')
    expect(cleanAiExpression('   \n  \t ')).toBe('')
    expect(parseGlossaryResponse('')).toBeNull()
    expect(parseGlossaryResponse('   ')).toBeNull()
  })
})

describe('Daily Words legacy context migration (Image 3 fix)', () => {
  it('clears sourceContext for Daily Words cards during migration query', () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        sourceContext TEXT
      );
    `)

    db.prepare(`
      INSERT INTO cards (type, front, back, sourceContext)
      VALUES 
        ('Daily Words', '(微波炉) 叮一下', 'nuke', '饿扁了，我去微波炉叮一个速冻便当'),
        ('Useful Expressions', 'ram through', 'To force...', 'some context'),
        ('Glossary', 'Kash Patel', 'def', 'glossary context')
    `).run()

    // Run Daily Words migration query
    const hasLegacyDailyWordsContext = db.prepare("SELECT 1 FROM cards WHERE type = 'Daily Words' AND sourceContext IS NOT NULL AND sourceContext != '' LIMIT 1").get()
    expect(hasLegacyDailyWordsContext).toBeTruthy()

    db.prepare("UPDATE cards SET sourceContext = NULL WHERE type = 'Daily Words'").run()

    const dailyWord = db.prepare("SELECT * FROM cards WHERE type = 'Daily Words'").get() as any
    expect(dailyWord.sourceContext).toBeNull()

    // Other non-migrated types in this step remain intact
    const glossary = db.prepare("SELECT * FROM cards WHERE type = 'Glossary'").get() as any
    expect(glossary.sourceContext).toBe('glossary context')
  })

  it('ensures Daily Words card creation sets empty sourceContext and does not display in preview', () => {
    const card = {
      type: 'Daily Words',
      front: '叮一下',
      back: 'nuke',
      sourceContext: '',
      imageUrl: 'test.jpg'
    }
    expect(card.sourceContext).toBe('')
  })
})

describe('extractJsonObject & extractJsonObjects robustness', () => {
  it('handles unescaped literal newlines in JSON strings', () => {
    const raw = `{\n  "rewritten_text": "First line of rewritten text\nand second line.",\n  "used_card_ids": [1, 2]\n}`
    const parsed = extractJsonObject(raw)
    expect(parsed).not.toBeNull()
    expect(parsed.rewritten_text).toContain('First line of rewritten text')
    expect(parsed.rewritten_text).toContain('and second line.')
    expect(parsed.used_card_ids).toEqual([1, 2])
  })

  it('handles unescaped control chars in JSON arrays of objects', () => {
    const raw = `[\n  {"original": "line 1\nline 2", "intent": "explanation"}\n]`
    const parsed = extractJsonObjects(raw)
    expect(parsed).not.toBeNull()
    expect(parsed![0].original).toContain('line 1')
    expect(parsed![0].intent).toBe('explanation')
  })

  it('correctly parses JSON arrays of strings without corrupting delimiter commas', () => {
    const raw = `["apple", "banana", "cherry"]`
    const escaped = escapeUnescapedControlCharsInJson(raw)
    expect(JSON.parse(escaped)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('handles JSON arrays of strings with unescaped newlines in extractJsonArray', () => {
    const raw = `[\n  "first item\nwith newline",\n  "second item"\n]`
    const parsed = extractJsonArray(raw)
    expect(parsed).toEqual(['first item\nwith newline', 'second item'])
  })
})

describe('Advanced quote & format edge cases', () => {
  it('does NOT strip quotes from sentences with multiple distinct quoted phrases', () => {
    const multipleQuotes = '"hard power" and "soft power"'
    expect(cleanAiExpression(multipleQuotes)).toBe('"hard power" and "soft power"')

    const wrappedSingle = '"a single quoted definition."'
    expect(cleanAiExpression(wrappedSingle)).toBe('a single quoted definition.')
  })

  it('strips numbered list prefixes from AI outputs', () => {
    const numbered = '1. To force the rapid acceptance of a law.'
    expect(cleanAiExpression(numbered)).toBe('To force the rapid acceptance of a law.')

    const parenNumbered = '(1) To force the rapid acceptance of a law.'
    expect(cleanAiExpression(parenNumbered)).toBe('To force the rapid acceptance of a law.')
  })

  it('collapses runaway dots into standard ellipsis or single dot', () => {
    const runaway = 'Waiting..... and more....'
    expect(cleanAiExpression(runaway)).toBe('Waiting... and more...')

    const doubleDot = 'Wait.. now'
    expect(cleanAiExpression(doubleDot)).toBe('Wait. now')
  })

  it('cleans orphaned punctuation in cleanGlossaryLine', () => {
    const raw = 'An American attorney and former official\n.'
    expect(cleanGlossaryLine(raw, true)).toBe('An American attorney and former official.')
  })

  it('alignTermWithUserTerm preserves proper capitalization when user enters lowercase', () => {
    // User types lowercase 'kash patel', model returns 'Kash Patel'
    const aligned = alignTermWithUserTerm('Kash Patel', 'kash patel')
    expect(aligned).toBe('Kash Patel')
  })

  it('alignTermWithUserTerm repairs broken extra spaces in model output using user word boundaries', () => {
    // Model output has broken wrap 'K ash Patel', user entered 'Kash Patel'
    const aligned1 = alignTermWithUserTerm('K ash Patel', 'Kash Patel')
    expect(aligned1).toBe('Kash Patel')

    // Model output has broken wrap 'K ash Patel', user entered lowercase 'kash patel'
    const aligned2 = alignTermWithUserTerm('K ash Patel', 'kash patel')
    expect(aligned2).toBe('Kash Patel')
  })
})

