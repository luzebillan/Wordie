/**
 * Expression Matcher Utility
 * 
 * Handles intelligent matching and highlighting of vocabulary cards in text.
 * Supports:
 * - Multiline cards (e.g. Chinese + English glossary)
 * - Parenthetical variants: "Chemo(therapy)" -> "Chemotherapy" | "Chemo"
 * - Placeholders: "be tuned in to sth." -> "be tuned in to"
 * - Middle placeholders: "prop sth. up" -> "prop ... up" | "prop up"
 * - Inflected 'be': "be tuned in to" -> "is/are/was/were/been/being/be tuned in to" | "tuned in to"
 * - Pronoun placeholders: "get one's due" -> "get their/his/her/my/our/your due"
 * - Reflexives: "shoot oneself in the foot" -> "shoot themselves/himself/herself... in the foot"
 * - Hyphen/whitespace tolerance: "be-all and end-all" -> "be[- ]all and end[- ]all"
 * - Optional leading articles: "the be-all and end-all" -> "(?:the )?be-all and end-all"
 * - Common verb inflections: "call the shots" -> "call(s|ed|ing) the shots"
 */

export interface MatchSpan {
  start: number
  end: number
  matchText: string
  card: any
}

export interface TextSegment {
  text: string
  card: any | null
}

const COMMON_VERB_INFLECTIONS: Record<string, string> = {
  call: 'call(?:s|ed|ing)?',
  get: '(?:get(?:s|ting)?|got|gotten)',
  take: '(?:take(?:s|n)?|taking|took)',
  give: '(?:give(?:s|n)?|giving|gave)',
  make: '(?:make(?:s)?|making|made)',
  keep: '(?:keep(?:s|ing)?|kept)',
  come: '(?:come(?:s)?|coming|came)',
  go: '(?:go(?:es)?|going|went|gone)',
  fall: '(?:fall(?:s|en|ing)?|fell)',
  bear: '(?:bear(?:s|ing)?|bore|borne)',
  strike: '(?:strike(?:s)?|striking|struck)',
  blow: '(?:blow(?:s|n|ing)?|blew)',
  shoot: '(?:shoot(?:s|ing)?|shot)',
  wind: '(?:wind(?:s|ing)?|wound)',
  turn: 'turn(?:s|ed|ing)?',
  plug: 'plug(?:s|ged|ging)?',
  prop: 'prop(?:s|ped|ping)?',
  push: 'push(?:es|ed|ing)?',
  crack: 'crack(?:s|ed|ing)?',
  win: '(?:win(?:s|ning)?|won)',
  relish: 'relish(?:es|ed|ing)?',
  grapple: 'grapple(?:s|d)?|grappling',
  double: 'double(?:s|d)?|doubling',
  nestle: 'nestle(?:s|d)?|nestling',
  dissipate: 'dissipate(?:s|d)?|dissipating',
  pay: '(?:pay(?:s|ing)?|paid)',
  feel: '(?:feel(?:s|ing)?|felt)',
  run: '(?:run(?:s|ning)?|ran)',
  stand: '(?:stand(?:s|ing)?|stood)',
  bring: '(?:bring(?:s|ing)?|brought)',
  hold: '(?:hold(?:s|ing)?|held)',
  catch: '(?:catch(?:es|ing)?|caught)',
  throw: '(?:throw(?:s|n|ing)?|threw)',
  draw: '(?:draw(?:s|n|ing)?|drew)',
  show: '(?:show(?:s|n|ing)?|showed)',
  break: '(?:break(?:s|ing)?|broke|broken)',
  lose: '(?:lose(?:s|ing)?|lost)',
  meet: '(?:meet(?:s|ing)?|met)',
  set: 'set(?:s|ting)?',
  let: 'let(?:s|ting)?',
  rule: 'rule(?:s|d)?|ruling',
  forge: 'forge(?:s|d)?|forging',
  pan: 'pan(?:s|ned|ning)?',
  ring: '(?:ring(?:s|ing)?|rang|rung)',
  wear: '(?:wear(?:s|ing)?|wore|worn)',
  tear: '(?:tear(?:s|ing)?|tore|torn)',
  speak: '(?:speak(?:s|ing)?|spoke|spoken)',
  write: '(?:write(?:s)?|writing|wrote|written)',
  drive: '(?:drive(?:s)?|driving|drove|driven)',
  ride: '(?:ride(?:s)?|riding|rode|ridden)',
  shake: '(?:shake(?:s)?|shaking|shook|shaken)',
  wake: '(?:wake(?:s)?|waking|woke|woken)',
  fly: '(?:fly(?:s|ing)?|flew|flown)',
  grow: '(?:grow(?:s|ing)?|grew|grown)',
  know: '(?:know(?:s|ing)?|knew|known)'
}

export function getVerbInflectionPattern(firstWord: string): string {
  const v = firstWord.toLowerCase()
  if (COMMON_VERB_INFLECTIONS[v]) {
    return COMMON_VERB_INFLECTIONS[v]
  }

  // Only apply regular inflection rules to plausible English words (length >= 3, alphabetic)
  if (v.length < 3 || !/^[a-z]+$/.test(v)) return v

  // Words that shouldn't be inflected as verbs
  const NON_VERB_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'about', 'after', 'before', 'under', 'over', 'into', 'onto',
    'this', 'that', 'these', 'those', 'some', 'many', 'much', 'very', 'more', 'most', 'such', 'what',
    'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how', 'all', 'any', 'both', 'each', 'few'
  ])
  if (NON_VERB_WORDS.has(v)) return v

  const forms = new Set<string>([v])

  // 3rd person singular (-s / -es)
  if (/[szx]|ch|sh$/.test(v)) {
    forms.add(v + 'es')
  } else if (/[^aeiou]y$/.test(v)) {
    forms.add(v.slice(0, -1) + 'ies')
  } else {
    forms.add(v + 's')
  }

  // Past / past participle (-ed / -d)
  if (/[^aeiou]y$/.test(v)) {
    forms.add(v.slice(0, -1) + 'ied')
  } else if (v.endsWith('e')) {
    forms.add(v + 'd')
  } else if (/[^aeiou][aeiou][b-df-hj-np-tv-z]$/.test(v) && !/[wxy]$/.test(v)) {
    forms.add(v + v.slice(-1) + 'ed')
  } else {
    forms.add(v + 'ed')
  }

  // Present participle (-ing)
  if (v.endsWith('ie')) {
    forms.add(v.slice(0, -2) + 'ying')
  } else if (v.endsWith('e') && !v.endsWith('ee')) {
    forms.add(v.slice(0, -1) + 'ing')
  } else if (/[^aeiou][aeiou][b-df-hj-np-tv-z]$/.test(v) && !/[wxy]$/.test(v)) {
    forms.add(v + v.slice(-1) + 'ing')
  } else {
    forms.add(v + 'ing')
  }

  return '(?:' + Array.from(forms).join('|') + ')'
}

/**
 * Generate regex patterns for a card front.
 */
export function buildTermRegexes(front: string): RegExp[] {
  if (!front || typeof front !== 'string') return []

  const lines = front.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const regexes: RegExp[] = []

  for (const line of lines) {
    // 1. Extract parenthetical variations:
    // e.g. "Chemo(therapy)" -> "Chemotherapy" (full) and "Chemo" (short)
    // e.g. "RFID (Radio Frequency...)" -> "RFID" and "Radio Frequency..."
    const rawVariants = new Set<string>()
    rawVariants.add(line)

    // Variant A: Remove parentheses characters only: "Chemo(therapy)" -> "Chemotherapy"
    const concatenated = line.replace(/[()]/g, '').trim()
    if (concatenated && concatenated !== line) {
      rawVariants.add(concatenated)
    }

    // Variant B: Remove entire parenthetical block: "Chemo(therapy)" -> "Chemo"
    const withoutParens = line.replace(/\([^)]+\)/g, ' ').replace(/\s+/g, ' ').trim()
    if (withoutParens && withoutParens !== line) {
      rawVariants.add(withoutParens)
    }

    // Variant C: Inner parenthetical if it's an acronym or alternate name
    const parenMatches = line.match(/\(([^)]+)\)/g)
    if (parenMatches) {
      for (const p of parenMatches) {
        const inner = p.slice(1, -1).trim()
        if (inner.length >= 2 && !/^(sth\.?|sb\.?|swh\.?|someone|something|somebody)$/i.test(inner)) {
          rawVariants.add(inner)
        }
      }
    }

    for (const v of rawVariants) {
      let clean = v.replace(/\*/g, ' ').trim()

      // Strip trailing placeholders
      clean = clean.replace(/\s+(?:sth\.?|sb\.?|something|somebody|someone|swh\.?|somewhere)\s*$/i, '').trim()
      clean = clean.replace(/\s+(?:sth|sb)\/(?:sth|sb)\s*$/i, '').trim()
      clean = clean.replace(/\s*\((?:sth\.?|sb\.?|something|somebody|someone|swh\.?|somewhere)\)\s*$/i, '').trim()

      // Handle middle placeholders: generate two patterns if placeholder in middle
      // Pattern 1: collapsed direct phrase: "prop sth. up" -> "prop up"
      const collapsedMiddle = clean.replace(/\s+(?:sth\.?|sb\.?|something|somebody|someone|swh\.?|somewhere)\s+/gi, ' ').trim()
      const hasMiddlePlaceholder = collapsedMiddle !== clean

      const forms = [clean]
      if (hasMiddlePlaceholder) {
        forms.push(collapsedMiddle)
      }

      for (const form of forms) {
        let textToProcess = form.trim()
        if (!textToProcess || textToProcess.length < 2) continue

        // Check for leading article in the card front
        let hasOptionalArticle = false
        const articleMatch = textToProcess.match(/^(?:the|a|an)\s+/i)
        if (articleMatch) {
          hasOptionalArticle = true
          textToProcess = textToProcess.slice(articleMatch[0].length).trim()
        } else if (/^be[- ]all\b/i.test(textToProcess)) {
          // Special case for "be-all and end-all" if card was created without leading "the"
          hasOptionalArticle = true
        }

        // Check for leading "be "
        let hasLeadingBe = false
        if (/^be\s+/i.test(textToProcess)) {
          hasLeadingBe = true
          textToProcess = textToProcess.slice(3).trim()
        }

        // Check first word for verb inflection (only if not preceded by "be " or optional article)
        let firstWordInflection: string | null = null
        let restOfPhrase = textToProcess

        if (!hasLeadingBe && !hasOptionalArticle) {
          const firstWordMatch = textToProcess.match(/^([a-zA-Z]+)(.*)$/s)
          if (firstWordMatch) {
            const word = firstWordMatch[1]
            const inflected = getVerbInflectionPattern(word)
            if (inflected !== word) {
              firstWordInflection = inflected
              restOfPhrase = firstWordMatch[2]
            }
          }
        }

        // Now escape and build regex parts
        // If middle placeholder present in form, convert to placeholder token before escaping
        let processedRest = restOfPhrase.replace(/\s+(?:sth\.?|sb\.?|something|somebody|someone|swh\.?|somewhere)\s+/gi, '___MID_PH___')

        // Escape regex special characters in processedRest
        processedRest = processedRest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        // Replace hyphen with hyphen-or-space tolerance
        processedRest = processedRest.replace(/-/g, '[- ]')

        // Normalize whitespace to \s+
        processedRest = processedRest.replace(/\s+/g, '\\s+')

        // Restore middle placeholder: 1 to 3 words
        processedRest = processedRest.replace(/___MID_PH___/g, '(?:\\s+[a-zA-Z0-9\'\\-]+){1,3}\\s+')

        // Handle one's / oneself in rest
        processedRest = processedRest.replace(/one's/gi, "(?:one's|their|his|her|my|our|your|the)")
        processedRest = processedRest.replace(/oneself/gi, "(?:oneself|themselves|himself|herself|myself|yourself|ourselves)")

        let finalPattern = ''

        if (hasLeadingBe) {
          finalPattern = '(?:(?:be|is|are|am|was|were|been|being)\\s+)?' + processedRest
        } else if (firstWordInflection) {
          // If followed by a phrasal particle, allow optional intensifier adverb (e.g. "barged right in")
          const particleMatch = processedRest.match(/^\\s\+((?:in|into|out|up|down|on|off|away|back|over|through|to|at|with|from|for|around)(?:\\s\+|$))/)
          if (particleMatch) {
            finalPattern = firstWordInflection + '(?:\\s+(?:right|straight|simply|already|just|deeply|fully))?' + processedRest
          } else {
            finalPattern = firstWordInflection + processedRest
          }
        } else {
          finalPattern = processedRest
        }

        if (hasOptionalArticle) {
          finalPattern = '(?:(?:the|a|an)\\s+)?' + finalPattern
        }

        // Add word boundaries
        const fullRegex = new RegExp(`(?<![a-zA-Z0-9])${finalPattern}(?![a-zA-Z0-9])`, 'i')
        regexes.push(fullRegex)
      }
    }
  }

  return regexes
}

/**
 * Checks whether a card's expression exists in a given text.
 */
export function isCardInText(card: any, text: string): boolean {
  if (!card || !card.front || !text) return false
  const regexes = buildTermRegexes(card.front)
  for (const reg of regexes) {
    if (reg.test(text)) return true
  }
  return false
}

/**
 * Finds all match spans for a list of cards in a text.
 */
export function findCardMatches(text: string, cards: any[]): MatchSpan[] {
  if (!text || !cards || cards.length === 0) return []

  const allMatches: MatchSpan[] = []

  for (const card of cards) {
    if (!card || !card.front) continue
    const regexes = buildTermRegexes(card.front)

    for (const reg of regexes) {
      const globalReg = new RegExp(reg.source, 'gi')
      let m: RegExpExecArray | null
      while ((m = globalReg.exec(text)) !== null) {
        allMatches.push({
          start: m.index,
          end: m.index + m[0].length,
          matchText: m[0],
          card
        })
      }
    }
  }

  return allMatches
}

/**
 * Splits text into non-overlapping segments, marking which spans match a card.
 */
export function segmentTextWithCards(text: string, cards: any[]): TextSegment[] {
  if (!text) return []
  if (!cards || cards.length === 0) return [{ text, card: null }]

  const matches = findCardMatches(text, cards)
  if (matches.length === 0) return [{ text, card: null }]

  // 1. Sort by length descending to prioritize longer phrases over shorter sub-phrases
  matches.sort((a, b) => (b.end - b.start) - (a.end - a.start))

  // 2. Select non-overlapping matches
  const chosen: MatchSpan[] = []
  for (const m of matches) {
    const overlaps = chosen.some(c => m.start < c.end && m.end > c.start)
    if (!overlaps) {
      chosen.push(m)
    }
  }

  // 3. Sort chosen matches by start position ascending
  chosen.sort((a, b) => a.start - b.start)

  // 4. Construct contiguous text segments
  const segments: TextSegment[] = []
  let lastIdx = 0

  for (const m of chosen) {
    if (m.start > lastIdx) {
      segments.push({ text: text.slice(lastIdx, m.start), card: null })
    }
    segments.push({ text: text.slice(m.start, m.end), card: m.card })
    lastIdx = m.end
  }

  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx), card: null })
  }

  return segments
}
