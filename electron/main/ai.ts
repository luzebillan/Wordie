import fs from 'fs'
import path from 'path'
import { getImagesDir } from './imageCache'

import { 
  DEFAULT_PROMPT_GLOSSARY,
  DEFAULT_PROMPT_DAILY_WORD,
  DEFAULT_PROMPT_REWRITE,
  DEFAULT_PROMPT_EXPRESSION,
  DEFAULT_PROMPT_REVISION_CLOZE,
  DEFAULT_PROMPT_PURE_LISTENER,
  DEFAULT_PROMPT_PRACTICE_EXTRACT,
  DEFAULT_PROMPT_PRACTICE_VERIFY,
  DEFAULT_PROMPT_PRACTICE_REWRITE,
  DEFAULT_PROMPT_AI_VERSION,
  DEFAULT_PROMPT_SYNONYMS
} from '../../src/constants/prompts'
import { isCardInText } from '../../src/utils/expressionMatcher'

export function escapeUnescapedControlCharsInJson(str: string): string {
  let inString = false
  let isEscaped = false
  let result = ''
  const stack: ('{' | '[')[] = []

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (isEscaped) {
      result += char
      isEscaped = false
      continue
    }

    if (char === '\\') {
      result += char
      isEscaped = true
      continue
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char)
        result += char
        continue
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) stack.pop()
        result += char
        continue
      } else if (char === '"') {
        inString = true
        result += char
        continue
      } else {
        if (char.charCodeAt(0) < 0x20 && char !== '\n' && char !== '\r' && char !== '\t') {
          // Skip illegal non-whitespace control character outside strings
        } else {
          result += char
        }
        continue
      }
    }

    // Inside string: check if char === '"'
    if (char === '"') {
      const rest = str.slice(i + 1)
      const currentContext = stack[stack.length - 1]

      let isDelimiter = false
      if (currentContext === '[') {
        // Inside array: closing quote of an element is followed by comma, closing bracket, or end of input
        isDelimiter = /^\s*(?:,|\]|$)/.test(rest)
      } else if (currentContext === '{') {
        // Inside object:
        // Could be closing quote of key (followed by colon ':')
        // Or closing quote of value (followed by comma + next key, or closing brace '}')
        isDelimiter = /^\s*(?::|,\s*(?:["']?[a-zA-Z0-9_\u4e00-\u9fa5]+["']?\s*:|[}\]])|[}]|$)/.test(rest)
      } else {
        // Root level
        isDelimiter = /^\s*(?:,|:|[}\]]|$)/.test(rest)
      }

      if (isDelimiter) {
        inString = false
        result += char
      } else {
        // Interior unescaped quote: escape it to preserve valid JSON
        result += '\\"'
      }
      continue
    }

    // Control characters inside strings
    if (char === '\n') {
      result += '\\n'
    } else if (char === '\r') {
      result += '\\r'
    } else if (char === '\t') {
      result += '\\t'
    } else if (char.charCodeAt(0) < 0x20) {
      result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')
    } else {
      result += char
    }
  }

  return result
}

export function cleanGlossaryLine(str: string, isEnglish: boolean = false): string {
  if (!str) return ''
  let cleaned = String(str).trim()

  // 1. Join CJK characters broken across newlines/whitespace (e.g., "第一\n  届" -> "第一届")
  cleaned = cleaned.replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])\s*[\r\n]+\s*(?=[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])/g, '$1')

  // 2. Join hyphenated words broken across newlines (e.g., "adminis-\n  tration" -> "administration")
  cleaned = cleaned.replace(/([a-zA-Z])-\s*[\r\n]+\s*([a-zA-Z])/g, '$1$2')

  // 3. Fix orphaned punctuation separated by newlines (e.g. "debate\n." -> "debate.")
  cleaned = cleaned.replace(/\s*[\r\n]+\s*([.,;:?!，。；：？！])/g, '$1')

  // 4. Join English words broken across newlines with a single space
  cleaned = cleaned.replace(/([a-zA-Z0-9.,;:?!])\s*[\r\n]+\s*([a-zA-Z0-9])/g, '$1 $2')

  // 5. Replace any remaining newlines with a space
  cleaned = cleaned.replace(/[\r\n]+/g, ' ')

  // 6. Join consecutive CJK characters separated by spaces (e.g. "卡 什 · 帕 特 尔" -> "卡什·帕特尔")
  // Using lookahead so every consecutive pair is matched without skipping alternate characters
  cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')

  // 7. Remove spaces between CJK characters and punctuation, or between CJK punctuation marks
  cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+(?=[，。！？；：、“”‘’（）《》·])/g, '$1')
  cleaned = cleaned.replace(/([，。！？；：、“”‘’（）《》·])\s+(?=[\u4e00-\u9fa5])/g, '$1')
  cleaned = cleaned.replace(/([，。！？；：、“”‘’（）《》·])\s+(?=[，。！？；：、“”‘’（）《》·])/g, '$1')

  // 8. Remove stray horizontal whitespace before punctuation marks (e.g. "word ." -> "word.")
  cleaned = cleaned.replace(/(\S)[ \t]+([.,;:?!，。；：？！])/g, '$1$2')

  // 9. Collapse multiple dots
  cleaned = cleaned.replace(/\.{4,}/g, '...')
  cleaned = cleaned.replace(/(?<!\.)\.\.(?!\.)/g, '.')

  // 10. Collapse multiple spaces into one space
  cleaned = cleaned.replace(/[ \t]+/g, ' ')

  return cleaned.trim()
}

export const GLOSSARY_FIELD_ALIASES: Record<'term_cn' | 'term_en' | 'def_cn' | 'def_en', string[]> = {
  term_cn: ['term_cn', 'termCn', 'term_zh', 'chinese_term', 'term_chinese', 'chineseTerm', 'chinese', '中文术语', '中文'],
  term_en: ['term_en', 'termEn', 'english_term', 'term_english', 'englishTerm', 'english', 'term', '英文术语', '英文'],
  def_cn: ['def_cn', 'defCn', 'def_zh', 'chinese_def', 'def_chinese', 'chineseDef', 'definition_cn', 'definition_zh', 'chinese_definition', '中文定义', '中文解释', '中文释义'],
  def_en: ['def_en', 'defEn', 'english_def', 'def_english', 'englishDef', 'definition_en', 'english_definition', 'definition', '英文定义', '英文解释', '英文释义']
}

export function extractGlossaryFieldsFromText(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  const allAliases = Object.values(GLOSSARY_FIELD_ALIASES).flat()
  const allAliasesPattern = allAliases.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  for (const [targetKey, aliases] of Object.entries(GLOSSARY_FIELD_ALIASES)) {
    for (const alias of aliases) {
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Match key with optional quotes/asterisks/bullets, followed by colon or equal sign
      const pattern = new RegExp(
        `(?:^|[\\r\\n,{]\\s*)[*"-]*\\s*${escapedAlias}\\s*[*"-]*\\s*[:=]\\s*(?:"|'|“)?([\\s\\S]*?)(?=(?:["'”]?\\s*[,;\\r\\n]+\\s*[*"-]*\\s*(?:${allAliasesPattern})\\s*[*"-]*\\s*[:=])|["'”]?\\s*\\}\\s*$|$)`,
        'i'
      )
      const match = text.match(pattern)
      if (match && match[1] && match[1].trim()) {
        let val = match[1].trim()
        // Strip trailing comma or quote
        val = val.replace(/^[ "“']+/, '').replace(/[ "”',]+$/, '')
        val = val.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\r/g, '')
        result[targetKey] = val
        break
      }
    }
  }

  return result
}

export function alignTermWithUserTerm(modelTerm: string, userTerm: string): string {
  const cleanModel = modelTerm.trim()
  const cleanUser = userTerm.trim()
  if (!cleanUser || !cleanModel) return cleanModel

  if (cleanModel === cleanUser) return cleanModel

  const modelNoSpace = cleanModel.replace(/\s+/g, '')
  const userNoSpace = cleanUser.replace(/\s+/g, '')
  if (modelNoSpace.toLowerCase() !== userNoSpace.toLowerCase()) {
    return cleanModel
  }

  // If user provided Chinese / CJK characters, userTerm is safe to use directly
  if (/[\u4e00-\u9fa5]/.test(cleanUser)) {
    return cleanUser
  }

  const userWords = cleanUser.split(/\s+/)
  let modelCharIndex = 0
  const modelChars = Array.from(modelNoSpace)
  const userChars = Array.from(userNoSpace)

  const reconstructedWords: string[] = []
  for (const word of userWords) {
    const wordLen = Array.from(word).length
    const sliceModel = modelChars.slice(modelCharIndex, modelCharIndex + wordLen)
    const sliceUser = userChars.slice(modelCharIndex, modelCharIndex + wordLen)
    modelCharIndex += wordLen

    let reconstructedWord = ''
    for (let i = 0; i < wordLen; i++) {
      const mCh = sliceModel[i] || ''
      const uCh = sliceUser[i] || ''
      if (mCh.toUpperCase() !== mCh.toLowerCase() && mCh === mCh.toUpperCase()) {
        reconstructedWord += mCh
      } else if (uCh.toUpperCase() !== uCh.toLowerCase() && uCh === uCh.toUpperCase()) {
        reconstructedWord += uCh
      } else {
        reconstructedWord += mCh || uCh
      }
    }
    reconstructedWords.push(reconstructedWord)
  }

  return reconstructedWords.join(' ')
}

export function parseGlossaryResponse(
  rawText: string,
  userTerm?: string
): { front: string; back: string } | null {
  if (!rawText || !rawText.trim()) return null

  let cleaned = rawText.trim()

  // 1. Strip markdown code fence if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // 2. Extract outermost JSON object { ... }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }

  let data: any = null

  // 3. Try standard JSON.parse
  try {
    data = JSON.parse(cleaned)
  } catch {}

  // 4. Try escaping unescaped newlines/control characters/internal quotes
  if (!data) {
    try {
      const escaped = escapeUnescapedControlCharsInJson(cleaned)
      data = JSON.parse(escaped)
    } catch {}
  }

  // 5. Try lenient sanitization (trailing commas, quotes, etc.)
  if (!data) {
    try {
      const sanitized = sanitizeLenientJson(escapeUnescapedControlCharsInJson(cleaned))
      data = JSON.parse(sanitized)
    } catch {}
  }

  // 6. Regex field extraction fallback for unquoted / markdown / malformed responses
  if (!data || typeof data !== 'object') {
    data = extractGlossaryFieldsFromText(cleaned)
  }

  if (!data) return null

  let termCn = data.term_cn || data.termCn || data.chinese_term || data.term_zh || ''
  let termEn = data.term_en || data.termEn || data.english_term || data.term || ''
  let defCn = data.def_cn || data.defCn || data.chinese_def || data.definition_cn || data.def_zh || ''
  let defEn = data.def_en || data.defEn || data.english_def || data.definition_en || ''

  termCn = cleanGlossaryLine(termCn, false)
  termEn = cleanGlossaryLine(termEn, true)
  defCn = cleanGlossaryLine(defCn, false)
  defEn = cleanGlossaryLine(defEn, true)

  // Align userTerm if provided
  if (userTerm && userTerm.trim()) {
    termEn = alignTermWithUserTerm(termEn, userTerm)
    termCn = alignTermWithUserTerm(termCn, userTerm)
  }

  if (!termCn && !termEn && !defCn && !defEn) {
    return null
  }

  // Fallbacks to ensure neither line is blank
  if (!termCn && termEn) termCn = termEn
  if (!termEn && termCn) termEn = termCn
  if (!defCn && defEn) defCn = defEn
  if (!defEn && defCn) defEn = defCn

  return {
    front: `${termCn}\n${termEn}`,
    back: `${defCn}\n${defEn}`
  }
}

export async function aiGenerateGlossary(
  labels: string[],
  term: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const template = settings['promptGlossary'] || DEFAULT_PROMPT_GLOSSARY
  const prompt = template
    .replace('{{term}}', term)
    .replace('{{labels}}', labels.join(', '))
  const res = await callAiApi(prompt, settings)
  if (!res.success) return res

  const parsed = parseGlossaryResponse(res.result || '', term)
  if (parsed) {
    return { success: true, result: JSON.stringify(parsed) }
  } else {
    return { success: false, error: 'Failed to parse AI response as JSON: ' + (res.result || '') }
  }
}

export async function aiGenerateDailyWord(
  payload: { picture?: string; context?: string; front?: string },
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const { picture, context, front: chineseWord } = payload

  const systemPrompt = settings['promptDailyWord'] || DEFAULT_PROMPT_DAILY_WORD

  let userPrompt = ''
  let imageBase64 = ''

  if (picture && chineseWord) {
    userPrompt = `So now could you please find the English counterpart for this picture, which in Chinese we call it "${chineseWord}"`
  } else if (context && chineseWord) {
    userPrompt = `So now could you please find the English counterpart for this Chinese word "${chineseWord}" in this context:\n"${context}"`
  } else if (picture) {
    userPrompt = `So now could you please find the English counterpart for this picture.`
  } else if (chineseWord) {
    // Fallback if no context/picture provided
    userPrompt = `So now could you please find the English counterpart for this Chinese word "${chineseWord}".`
  } else {
    return { success: false, error: 'No input provided for Daily Word generation.' }
  }

  if (picture) {
    if (picture.startsWith('http')) {
      try {
        const fetchRes = await fetch(picture, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        })
        if (!fetchRes.ok) {
          return { success: false, error: `Failed to download external image: ${fetchRes.status}` }
        }
        const arrayBuffer = await fetchRes.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const contentType = fetchRes.headers.get('content-type') || 'image/jpeg'
        imageBase64 = `data:${contentType};base64,${base64}`
      } catch (err: any) {
        return { success: false, error: 'Failed to read external image: ' + err.message }
      }
    } else {
      try {
        const filepath = path.join(getImagesDir(), picture)
        const ext = path.extname(picture).replace('.', '') || 'jpeg'
        const base64 = fs.readFileSync(filepath, { encoding: 'base64' })
        imageBase64 = `data:image/${ext};base64,${base64}`
      } catch (err: any) {
        return { success: false, error: 'Failed to read local image: ' + err.message }
      }
    }
  }

  // Need custom API call to pass images properly
  const apiKey = settings['aiKey']
  let apiUrl = settings['aiUrl'] || 'https://api.openai.com/v1'
  const model = settings['aiModel'] || 'gpt-4o' // Ensure this model has vision

  if (!apiKey) {
    return { success: false, error: 'AI API Key is not configured in Settings.' }
  }
  if (!apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
  }

  const content: any[] = [{ type: 'text', text: userPrompt }]
  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: imageBase64 }
    })
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      return { success: false, error: `API Error (${response.status}): ${errorData}` }
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content?.trim()
    if (!result) return { success: false, error: 'API returned an empty response.' }

    return { success: true, result: cleanAiExpression(result) }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error occurred.' }
  }
}

export async function aiRewritePractice(text: string, targetWords: string[], settings: any) {
  const dbText = targetWords.join('\n')
  const template = settings['promptRewrite'] || DEFAULT_PROMPT_REWRITE
  const prompt = template
    .replace('{{dbText}}', dbText)
    .replace('{{text}}', text)

  return callAiApi(prompt, settings)
}

// Unused generation (Ready Versions is direct input only per PDF)
export async function aiGenerateReadyVersion(
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  return { success: false, error: 'Ready Versions do not use AI.' }
}

// Shared API call logic
async function callAiApi(prompt: string, settings: Record<string, string>) {
  const apiKey = settings['aiKey']
  let apiUrl = settings['aiUrl'] || 'https://api.openai.com/v1'
  const model = settings['aiModel'] || 'gpt-4o'

  if (!apiKey) {
    return { success: false, error: 'AI API Key is not configured in Settings.' }
  }

  if (!apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000
        }),
        signal: AbortSignal.timeout(60000) // 60s timeout
      })

      if (!response.ok) {
        const errorData = await response.text()
        return { success: false, error: `API Error (${response.status}): ${errorData}` }
      }

      const data = await response.json()
      const result = data.choices?.[0]?.message?.content?.trim()

      if (!result) {
        return { success: false, error: 'API returned an empty response.' }
      }

      return { success: true, result }
    } catch (error: any) {
      lastError = error;
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
    }
  }
  
  const cause = lastError?.cause ? ` (Cause: ${lastError.cause.message || lastError.cause})` : '';
  return { success: false, error: `${lastError?.name === 'TimeoutError' ? 'Request timed out' : lastError?.message || 'Network error occurred'}${cause}` }
}

export function isFullyWrappedInQuotes(str: string): { isWrapped: boolean; inner: string; trailingPunct: string } {
  const s = str.trim()
  if (s.length < 2) return { isWrapped: false, inner: s, trailingPunct: '' }

  const quotePairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['`', '`'],
    ['‘', '’'],
    ['«', '»']
  ]

  for (const [openQ, closeQ] of quotePairs) {
    if (s.startsWith(openQ)) {
      const trailingPunctMatch = s.match(/([.,;:?!，。；：？！]?)$/)
      const trailingPunct = trailingPunctMatch ? trailingPunctMatch[1] : ''
      const endWithoutPunct = s.slice(0, s.length - trailingPunct.length)

      if (endWithoutPunct.endsWith(closeQ) && endWithoutPunct.length >= openQ.length + closeQ.length) {
        const innerCandidate = endWithoutPunct.slice(openQ.length, endWithoutPunct.length - closeQ.length)
        
        // Find the first unescaped occurrence of closeQ in innerCandidate
        let firstCloseIndex = -1
        let isEsc = false
        for (let i = 0; i < innerCandidate.length; i++) {
          const ch = innerCandidate[i]
          if (isEsc) {
            isEsc = false
            continue
          }
          if (ch === '\\') {
            isEsc = true
            continue
          }
          if (ch === closeQ) {
            firstCloseIndex = i
            break
          }
        }

        // If closeQ does not appear unescaped in innerCandidate, it is fully wrapped by this pair
        if (firstCloseIndex === -1) {
          return { isWrapped: true, inner: innerCandidate.trim(), trailingPunct }
        }
      }
    }
  }

  return { isWrapped: false, inner: s, trailingPunct: '' }
}

export function stripWrappingQuotes(str: string): string {
  let s = str.trim()

  const { isWrapped, inner, trailingPunct } = isFullyWrappedInQuotes(s)
  if (isWrapped) {
    if (trailingPunct && /[.,;:?!，。；：？！]$/.test(inner)) {
      s = inner
    } else {
      s = inner + trailingPunct
    }
  }

  // Strip lone unbalanced outer quotation marks if the interior doesn't contain matching quotes
  if (s.startsWith('"') && !s.slice(1).includes('"')) s = s.slice(1).trim()
  if (s.startsWith('“') && !s.slice(1).includes('”')) s = s.slice(1).trim()
  if (s.endsWith('"') && !s.slice(0, -1).includes('"')) s = s.slice(0, -1).trim()
  if (s.endsWith('”') && !s.slice(0, -1).includes('“')) s = s.slice(0, -1).trim()
  return s
}

export function cleanAiExpression(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.trim()

  // 1. Strip markdown code fence if present
  const codeBlockMatch = cleaned.match(/^```(?:[a-zA-Z]+)?\s*([\s\S]*?)\s*```$/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  } else {
    const innerCodeBlock = cleaned.match(/```(?:[a-zA-Z]+)?\s*([\s\S]*?)\s*```/)
    if (innerCodeBlock) {
      cleaned = innerCodeBlock[1].trim()
    }
  }

  // 2. Strip boilerplate prefixes (e.g. "Definition: ...", "Meaning: ...", "Translation: ...")
  cleaned = cleaned.replace(/^(?:definition|meaning|explanation|translation|answer)\s*:\s*/i, '')

  // 3. Strip leading bullet markers or list numbers (e.g. "- ", "* ", "• ", "1. ", "1) ")
  cleaned = cleaned.replace(/^[-*•]\s+/, '')
  cleaned = cleaned.replace(/^(?:\d+[\.\)]|\([0-9]+\))\s+/, '')

  // 4. Drop redundant punctuation across quotes (e.g. 'law."\n.' -> 'law."')
  cleaned = cleaned.replace(/([.,;:?!，。；：？！])(["'”`])\s*[\r\n]+\s*[.,;:?!，。；：？！]+/g, '$1$2')

  // 5. Strip surrounding quotes if wrapped
  cleaned = stripWrappingQuotes(cleaned)

  // 6. If previous text already ends with punctuation, drop redundant punctuation on newline
  cleaned = cleaned.replace(/([.,;:?!，。；：？！])\s*[\r\n]+\s*[.,;:?!，。；：？！]+/g, '$1')

  // 7. Fix orphaned punctuation separated by newlines (e.g. "debate\n." -> "debate.")
  cleaned = cleaned.replace(/\s*[\r\n]+\s*([.,;:?!，。；：？！])/g, '$1')

  // 8. Remove stray horizontal whitespace before punctuation marks (e.g. "debate ." -> "debate.")
  cleaned = cleaned.replace(/(\S)[ \t]+([.,;:?!，。；：？！])/g, '$1$2')

  // 9. Collapse all remaining newlines into a single space (concise definitions should not contain artificial soft wraps)
  cleaned = cleaned.replace(/\s*[\r\n]+\s*/g, ' ')

  // 10. Collapse accidental duplicate dots/commas (preserving standard ellipsis "...")
  cleaned = cleaned.replace(/([,;:?!，。；：？！])\1+/g, '$1')
  cleaned = cleaned.replace(/\.{4,}/g, '...')
  cleaned = cleaned.replace(/(?<!\.)\.\.(?!\.)/g, '.')

  // 11. Re-strip surrounding/lone quotes in case punctuation or newline cleanup exposed them
  cleaned = stripWrappingQuotes(cleaned)

  // 12. Clean excess horizontal whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' ').trim()

  return cleaned
}

export async function aiGenerateExpression(
  context: string,
  style: string,
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const template = settings['promptExpression'] || DEFAULT_PROMPT_EXPRESSION
  const prompt = template
    .replace(/{{front}}/g, front)
    .replace('{{context}}', context)

  const res = await callAiApi(prompt, settings)
  if (!res.success || !res.result) return res

  return { success: true, result: cleanAiExpression(res.result) }
}

export function formatSketchEnginePhrase(front: string): { cleanPhrase: string; searchWords: string[]; cqlTokens: string[] } {
  let clean_phrase = front.replace(/\*/g, " ").toLowerCase()
  clean_phrase = clean_phrase.replace(/[\u2018\u2019]/g, "'") // normalize curly apostrophes
  const placeholders = ["someone", "something", "sb.", "sb", "sth.", "sth", "one's", "ones", "oneself", "be"]
  
  for (const p of placeholders) {
    const escaped_p = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Specifically ensure 'anyone's' is never stripped when stripping 'one's'
    const regex = new RegExp(`(?<![a-z]|any)${escaped_p}(?![a-z])`, 'g')
    clean_phrase = clean_phrase.replace(regex, '*')
  }
  
  clean_phrase = clean_phrase.replace(/\s*\*\s*/g, '*')
  clean_phrase = clean_phrase.replace(/\*+/g, '*').trim()
  
  const parts = clean_phrase.split('*')
  const cql_tokens: string[] = []
  const search_words: string[] = []
  
  parts.forEach((part, i) => {
    const words = part.split(/\s+/).filter(Boolean)
    words.forEach(w => {
      search_words.push(w)
      if (w.endsWith('s') || w.endsWith('ing') || w.endsWith('ed') || w.endsWith('d') || w.endsWith('es') || w.endsWith('en') || w.endsWith('ought') || w.endsWith('own') || w.endsWith('aught')) {
        cql_tokens.push(`[word="(?i)${w}"]`)
      } else {
        cql_tokens.push(`[lemma_lc="${w}"]`)
      }
    })
    
    if (i < parts.length - 1 && words.length > 0) {
      cql_tokens.push('[]{1,2}')
    }
  })

  return { cleanPhrase: clean_phrase, searchWords: search_words, cqlTokens: cql_tokens }
}

export async function generateRevisionCloze(
  front: string,
  back: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const sketchApiKey = settings['sketchEngineKey'] || ''
  const sketchApiUrl = settings['sketchEngineUrl'] || 'https://api.sketchengine.eu/bonito/run.cgi'
  if (!sketchApiKey) {
    return { success: false, error: 'Missing Sketch Engine API Key in Settings.' }
  }

  const { searchWords, cqlTokens } = formatSketchEnginePhrase(front)
  const cql_query = cqlTokens.join(' ')
  
  let sketchBaseUrl = sketchApiUrl
  if (sketchBaseUrl.endsWith('/')) {
    sketchBaseUrl = sketchBaseUrl.slice(0, -1)
  }
  if (!sketchBaseUrl.endsWith('/concordance')) {
    sketchBaseUrl += '/concordance'
  }
  const url = `${sketchBaseUrl}?corpname=preloaded/ententen21_tt31&format=json&q=q${encodeURIComponent(cql_query)}&viewmode=sen&attrs=word&ctxattrs=word&refs=doc.url&asyn=0`
  
  let clean_snippet = ''
  
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${sketchApiKey}`, 'Connection': 'close' },
        signal: AbortSignal.timeout(180000)
      })
      
      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 5000))
        continue
      }
      if (!response.ok) {
        break
      }
      
      const data = await response.json()
      if (data.Lines && data.Lines.length > 0) {
        const chosen = data.Lines[Math.floor(Math.random() * data.Lines.length)]
        const raw_data = JSON.stringify(chosen)
        const match = raw_data.match(/<s>(.*?)<\/s>/i)
        if (match) {
          clean_snippet = match[1]
        } else {
          const extractStr = (arr: any[]) => arr ? arr.map((i: any) => i.str || '').join('') : ''
          clean_snippet = extractStr(chosen.Left) + extractStr(chosen.Kwic) + extractStr(chosen.Right)
        }
        
        clean_snippet = clean_snippet.replace(/<[^>]+>/g, '')
        clean_snippet = clean_snippet.replace(/\s+([.,!?;\):'"”])/g, '$1')
        clean_snippet = clean_snippet.replace(/([\(\['"“])\s+/g, '$1')
        clean_snippet = clean_snippet.replace(/\s+/g, ' ').trim()
        break
      } else {
        return { success: false, error: 'Sketch Engine search succeeded, but 0 sentences matched this grammar.' }
      }
    } catch (e: any) {
      if (attempt === 1) return { success: false, error: 'Sketch Engine API crashed: ' + String(e) }
      await new Promise(r => setTimeout(r, 3000))
    }
  }

  if (!clean_snippet) {
    return { success: false, error: 'Failed to retrieve context from Sketch Engine.' }
  }

  const display_phrase = front.replace(/\*/g, " ")

  const wordsToBlank = searchWords.join(', ')

  const template = settings['promptRevisionCloze'] || DEFAULT_PROMPT_REVISION_CLOZE
  const aiPrompt = template
    .replace('{{display_phrase}}', display_phrase)
    .replace('{{back}}', back)
    .replace('{{clean_snippet}}', clean_snippet)
    .replace('{{wordsToBlank}}', wordsToBlank)

  const aiRes = await callAiApi(aiPrompt, settings)
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to rewrite context: ' + aiRes.error }
  }

  let rewrittenText = aiRes.result.trim()
  const codeBlockMatch = rewrittenText.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    rewrittenText = codeBlockMatch[1].trim()
  }

  return { success: true, result: rewrittenText }
}

// -----------------------------------------------------------------------------
// Practice Module API Functions
// -----------------------------------------------------------------------------

export async function practicePureListener(text: string, settings: any) {
  const template = settings['promptPureListener'] || DEFAULT_PROMPT_PURE_LISTENER
  const prompt = template.replace('{{text}}', text)

  const aiRes = await callAiApi(prompt, settings)
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to analyze: ' + aiRes.error }
  }
  return { success: true, result: aiRes.result.trim() }
}

export function sanitizeLenientJson(str: string): string {
  return str
    // Replace single quotes that act as delimiters, preserving apostrophes inside words (e.g., one's, don't)
    .replace(/(?<![a-zA-Z0-9])'|'(?![a-zA-Z0-9])/g, '"')
    // Remove trailing commas before closing brackets and braces
    .replace(/,\s*([\]}])/g, '$1')
}

export function extractJsonObjects<T = any>(rawText: string): T[] | null {
  if (!rawText) return null
  let cleaned = rawText.trim()
  
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  const firstBracket = cleaned.indexOf('[')
  const lastBracket = cleaned.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1)
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
  } catch {}

  try {
    const sanitized = sanitizeLenientJson(cleaned)
    const parsed = JSON.parse(sanitized)
    if (Array.isArray(parsed)) return parsed
  } catch {}

  try {
    const escaped = escapeUnescapedControlCharsInJson(cleaned)
    const parsed = JSON.parse(escaped)
    if (Array.isArray(parsed)) return parsed
  } catch {}

  try {
    const sanitized = sanitizeLenientJson(escapeUnescapedControlCharsInJson(cleaned))
    const parsed = JSON.parse(sanitized)
    if (Array.isArray(parsed)) return parsed
  } catch {}

  return null
}

export function extractJsonObject<T = any>(rawText: string): T | null {
  if (!rawText) return null
  let cleaned = rawText.trim()
  
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
  } catch {}

  try {
    const sanitized = sanitizeLenientJson(cleaned)
    const parsed = JSON.parse(sanitized)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
  } catch {}

  try {
    const escaped = escapeUnescapedControlCharsInJson(cleaned)
    const parsed = JSON.parse(escaped)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
  } catch {}

  try {
    const sanitized = sanitizeLenientJson(escapeUnescapedControlCharsInJson(cleaned))
    const parsed = JSON.parse(sanitized)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
  } catch {}

  return null
}

export async function practiceRewrite(text: string, settings: any, dbHandlers: any) {
  if (!text || text.trim() === '') {
    return { success: true, result: { text: '', cards: [] } }
  }

  let allCards = dbHandlers.getCards ? dbHandlers.getCards('Useful Expressions') : []
  if (!allCards || allCards.length === 0) {
    // Fallback to all cards if no 'Useful Expressions' specific cards exist
    allCards = dbHandlers.getCards ? dbHandlers.getCards() : []
  }
  
  allCards = (allCards || []).filter((c: any) => c && c.front && String(c.front).trim().length > 0)

  if (!allCards || allCards.length === 0) {
    return { success: false, error: 'Your database is empty. Add some Useful Expressions first!' }
  }

  let candidateCards: any[] = []
  if (allCards.length <= 100) {
    // Total <= 100: Pass all cards, prioritizing due cards first
    let dueCardIds = new Set<number>()
    try {
      if (dbHandlers.getDueCards) {
        const dueCards = dbHandlers.getDueCards() || []
        dueCardIds = new Set(dueCards.map((c: any) => c.id))
      }
    } catch {}

    candidateCards = [...allCards].sort((a, b) => {
      const aDue = dueCardIds.has(a.id) ? 1 : 0
      const bDue = dueCardIds.has(b.id) ? 1 : 0
      return bDue - aDue
    })
  } else {
    // Total > 100: Use top 25 candidates via hybrid/vector search
    const candidateMap = new Map<number, any>()

    // 1. Vector similarity search on input text
    try {
      if (dbHandlers.searchVectorCards) {
        const vectorMatches = await dbHandlers.searchVectorCards(text, 'Useful Expressions', 25)
        if (Array.isArray(vectorMatches)) {
          for (const c of vectorMatches) {
            candidateMap.set(c.id, c)
            if (candidateMap.size >= 25) break
          }
        }
      } else if (dbHandlers.findSimilarCards) {
        const similar = await dbHandlers.findSimilarCards(text, '', 'Useful Expressions', false, '', { minScore: 0, limit: 25 })
        if (Array.isArray(similar)) {
          for (const c of similar) {
            candidateMap.set(c.id, c)
            if (candidateMap.size >= 25) break
          }
        }
      }
    } catch (e) {
      console.warn("[Practice Rewrite] Vector candidate search failed:", e)
    }

    // 2. Supplement with lexical FTS search
    if (candidateMap.size < 25 && dbHandlers.searchCards) {
      try {
        const ftsMatches = dbHandlers.searchCards(text, 'Useful Expressions', 25 - candidateMap.size)
        if (Array.isArray(ftsMatches)) {
          for (const c of ftsMatches) {
            if (!candidateMap.has(c.id)) {
              candidateMap.set(c.id, c)
              if (candidateMap.size >= 25) break
            }
          }
        }
      } catch {}
    }

    // 3. Supplement with priority due cards if still < 25
    if (candidateMap.size < 25 && dbHandlers.getDueCards) {
      try {
        const dueCards = (dbHandlers.getDueCards() || []).filter((c: any) => c.type === 'Useful Expressions' || !c.type)
        for (const c of dueCards) {
          if (!candidateMap.has(c.id)) {
            candidateMap.set(c.id, c)
            if (candidateMap.size >= 25) break
          }
        }
      } catch {}
    }

    // 4. Fallback to allCards if still < 25
    if (candidateMap.size < 25) {
      for (const c of allCards) {
        if (!candidateMap.has(c.id)) {
          candidateMap.set(c.id, c)
          if (candidateMap.size >= 25) break
        }
      }
    }

    candidateCards = Array.from(candidateMap.values()).slice(0, 25)
  }

  if (candidateCards.length === 0) {
    return {
      success: true,
      result: {
        text: text,
        cards: []
      }
    }
  }

  // Build <vocabulary_bank> string
  const vocabBankStr = candidateCards.map(c => {
    const def = c.back && c.back.trim() ? ` — Definition: ${c.back.trim()}` : ''
    return `[ID: ${c.id}] "${c.front}"${def}`
  }).join('\n')

  const template = settings['promptPracticeRewrite'] || DEFAULT_PROMPT_PRACTICE_REWRITE
  const prompt = template
    .replaceAll('{{vocabulary_bank}}', vocabBankStr)
    .replaceAll('{{vocabularyBank}}', vocabBankStr)
    .replaceAll('{{cardsContext}}', vocabBankStr)
    .replaceAll('{{replacementsContext}}', vocabBankStr)
    .replaceAll('{{text}}', text)
    .replaceAll('{{input_text}}', text)

  const aiRes = await callAiApi(prompt, settings)
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to rewrite text: ' + (aiRes.error || 'Empty response') }
  }

  let rewrittenText = text
  let usedCardIds: number[] = []

  const parsed = extractJsonObject<any>(aiRes.result)
  if (parsed) {
    if (typeof parsed.rewritten_text === 'string') {
      rewrittenText = parsed.rewritten_text.trim()
    } else if (typeof parsed.rewritten === 'string') {
      rewrittenText = parsed.rewritten.trim()
    } else if (typeof parsed.text === 'string') {
      rewrittenText = parsed.text.trim()
    } else if (typeof parsed.result === 'string') {
      rewrittenText = parsed.result.trim()
    }

    const rawIds = parsed.used_card_ids || parsed.usedCardIds || parsed.card_ids || parsed.cardIds || parsed.cards || []
    if (Array.isArray(rawIds)) {
      for (const item of rawIds) {
        if (typeof item === 'number') {
          usedCardIds.push(item)
        } else if (typeof item === 'string') {
          const itemStr = item.toLowerCase().trim()
          const found = candidateCards.find(c => {
            const frontClean = (c.front || '').replace(/\*/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim()
            return frontClean === itemStr || (c.front || '').toLowerCase().trim() === itemStr
          })
          if (found) {
            usedCardIds.push(found.id)
          } else {
            const match = item.match(/\d+/)
            if (match) {
              usedCardIds.push(parseInt(match[0], 10))
            }
          }
        } else if (item && typeof item === 'object' && item.id !== undefined) {
          const idNum = typeof item.id === 'number' ? item.id : parseInt(String(item.id).match(/\d+/)?.[0] || '', 10)
          if (!isNaN(idNum)) usedCardIds.push(idNum)
        }
      }
    }
  } else {
    // If model returned plain text or markdown block
    let raw = aiRes.result.trim()
    const codeBlockMatch = raw.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/)
    rewrittenText = (codeBlockMatch ? codeBlockMatch[1] : raw).trim()
  }

  const usedIdSet = new Set(usedCardIds)
  let finalCards = candidateCards.filter(c => usedIdSet.has(c.id))

  // Fallback text match if model referenced card front string
  if (finalCards.length === 0 && usedCardIds.length === 0 && parsed) {
    const rawIds = parsed.used_card_ids || parsed.usedCardIds || parsed.cards || []
    if (Array.isArray(rawIds)) {
      for (const item of rawIds) {
        const itemStr = String(item).toLowerCase().trim()
        const found = candidateCards.find(c => {
          const frontClean = (c.front || '').replace(/\*/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim()
          return frontClean === itemStr || (c.front || '').toLowerCase().trim() === itemStr
        })
        if (found && !finalCards.includes(found)) {
          finalCards.push(found)
        }
      }
    }
  }

  const codeMatch = rewrittenText.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/)
  if (codeMatch) {
    rewrittenText = codeMatch[1].trim()
  }

  if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"') && rewrittenText.length >= 2) {
    rewrittenText = rewrittenText.slice(1, -1).trim()
  }

  // Scan rewrittenText for integrated expressions from candidate cards and the entire library.
  // Supplement finalCards with any expressions present in rewrittenText so they are reliably highlighted.
  const allLibraryCards = (dbHandlers.getCards ? dbHandlers.getCards() : allCards) || []
  const checkedCardIds = new Set<number>(finalCards.map(c => c.id))

  // First check candidate cards (prioritized)
  if (candidateCards && candidateCards.length > 0) {
    for (const card of candidateCards) {
      if (checkedCardIds.has(card.id)) continue
      checkedCardIds.add(card.id)
      if (isCardInText(card, rewrittenText)) {
        finalCards.push(card)
      }
    }
  }

  // Also check remaining library cards so any card in the user's database is highlighted if used
  if (allLibraryCards && allLibraryCards.length > 0) {
    for (const card of allLibraryCards) {
      if (checkedCardIds.has(card.id)) continue
      checkedCardIds.add(card.id)
      if (isCardInText(card, rewrittenText)) {
        finalCards.push(card)
      }
    }
  }

  return {
    success: true,
    result: {
      text: rewrittenText,
      cards: finalCards
    }
  }
}

export async function practiceAiVersion(text: string, settings: any) {
  const template = settings['promptAiVersion'] || DEFAULT_PROMPT_AI_VERSION
  const prompt = template.replace('{{text}}', text)

  const aiRes = await callAiApi(prompt, settings)
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to generate elite version: ' + aiRes.error }
  }
  return { success: true, result: aiRes.result.trim() }
}

export function extractJsonArray(rawText: string): string[] | null {
  if (!rawText) return null
  let cleaned = rawText.trim()
  
  // 1. Check for markdown code fence ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // 2. Extract substring between outermost [ and ]
  const firstBracket = cleaned.indexOf('[')
  const lastBracket = cleaned.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1)
  }

  // 3. Try standard JSON.parse
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(Boolean)
    }
  } catch {}

  // 4. Try lenient parsing: replace delimiter single quotes with double quotes, remove trailing commas
  try {
    const sanitized = sanitizeLenientJson(cleaned)
    const parsed = JSON.parse(sanitized)
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(Boolean)
    }
  } catch {}

  try {
    const escaped = escapeUnescapedControlCharsInJson(cleaned)
    const parsed = JSON.parse(escaped)
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(Boolean)
    }
  } catch {}

  try {
    const sanitized = sanitizeLenientJson(escapeUnescapedControlCharsInJson(cleaned))
    const parsed = JSON.parse(sanitized)
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(Boolean)
    }
  } catch {}

  // 5. Fallback regex to match numbers or quoted strings inside the bracketed text
  const itemMatches = cleaned.match(/["']?(\d+)["']?/g)
  if (itemMatches) {
    const ids = itemMatches.map(m => m.replace(/["']/g, '').trim()).filter(Boolean)
    if (ids.length > 0) {
      return Array.from(new Set(ids))
    }
  }

  if (cleaned === '[]') return []

  return null
}

export async function aiFilterSynonyms(
  targetFront: string,
  targetBack: string,
  candidates: any[],
  settings: any,
  context: string = ''
): Promise<{ success: boolean; result?: string[]; error?: string }> {
  if (!candidates || candidates.length === 0) {
    return { success: true, result: [] }
  }

  // Construct candidates string
  const candidatesStr = candidates.map(c => `[ID: ${c.id}] Word: ${c.front}\nDefinition: ${c.back}`).join('\n\n')

  const template = settings['promptSynonyms'] || DEFAULT_PROMPT_SYNONYMS
  const prompt = template
    .replaceAll('{{targetFront}}', targetFront)
    .replaceAll('{{targetBack}}', targetBack)
    .replaceAll('{{context}}', context || '')
    .replaceAll('{{targetContext}}', context || '')
    .replaceAll('{{candidatesStr}}', candidatesStr)

  const aiRes = await callAiApi(prompt, settings)
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to filter synonyms: ' + (aiRes.error || 'Empty response') }
  }

  const ids = extractJsonArray(aiRes.result)
  if (ids !== null) {
    return { success: true, result: ids }
  }

  return { success: false, error: 'Failed to parse AI response as JSON array: ' + aiRes.result }
}
