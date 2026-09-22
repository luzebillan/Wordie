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
  DEFAULT_PROMPT_PRACTICE_REWRITE,
  DEFAULT_PROMPT_AI_VERSION,
  DEFAULT_PROMPT_SYNONYMS
} from '../../src/constants/prompts'
import { isCardInText, parseMarkedText, segmentTextWithCards, type TextSegment } from '../../src/utils/expressionMatcher'
export { parseMarkedText }

interface ObjectFrame {
  type: '{'
  expect: 'key' | 'colon' | 'value' | 'comma_or_end'
}
interface ArrayFrame {
  type: '['
}
type StackFrame = ObjectFrame | ArrayFrame

export function escapeUnescapedControlCharsInJson(str: string): string {
  let inString = false
  let isEscaped = false
  let result = ''
  const stack: StackFrame[] = []

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
      if (char === '{') {
        stack.push({ type: '{', expect: 'key' })
        result += char
        continue
      } else if (char === '[') {
        stack.push({ type: '[' })
        result += char
        continue
      } else if (char === '}') {
        if (stack.length > 0) stack.pop()
        const top = stack[stack.length - 1]
        if (top && top.type === '{') top.expect = 'comma_or_end'
        result += char
        continue
      } else if (char === ']') {
        if (stack.length > 0) stack.pop()
        const top = stack[stack.length - 1]
        if (top && top.type === '{') top.expect = 'comma_or_end'
        result += char
        continue
      } else if (char === ':') {
        const top = stack[stack.length - 1]
        if (top && top.type === '{') top.expect = 'value'
        result += char
        continue
      } else if (char === ',') {
        const top = stack[stack.length - 1]
        if (top && top.type === '{') top.expect = 'key'
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
      const top = stack[stack.length - 1]

      let isDelimiter = false
      if (!top) {
        // Root level
        isDelimiter = /^\s*(?:,|:|[}\]]|$)/.test(rest)
      } else if (top.type === '[') {
        // Inside array: closing quote of an element is followed by comma, closing bracket, or end of input
        isDelimiter = /^\s*(?:,|\]|$)/.test(rest)
      } else if (top.type === '{') {
        if (top.expect === 'key') {
          // Inside object key: closing quote of a key MUST be followed by colon ':'
          isDelimiter = /^\s*:/.test(rest)
        } else {
          // Inside object value: closing quote of a value is followed by comma + next key, or closing brace '}', or end
          // Also supports missing comma where next key follows immediately: (?=["'])
          isDelimiter = /^\s*(?:(?:,|(?=["']))\s*(?:["'][^"':]{1,60}["']\s*:|\*\*[a-zA-Z0-9_\s-]{1,60}\*\*\s*:|[a-zA-Z_$][a-zA-Z0-9_$-]{0,60}\s*:|[}\]])|[}\]]|$)/.test(rest)
        }
      }

      if (isDelimiter) {
        inString = false
        if (top && top.type === '{') {
          if (top.expect === 'key') {
            top.expect = 'colon'
          } else {
            if (/^\s*["'*a-zA-Z_$]/.test(rest)) {
              top.expect = 'key'
            } else {
              top.expect = 'comma_or_end'
            }
          }
        }
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

  // 2. Join digits broken across newlines (e.g., "199\n  3" -> "1993")
  cleaned = cleaned.replace(/(\d)\s*[\r\n]+\s*(?=\d)/g, '$1')

  // 3. Join digits and CJK characters/punctuation broken across newlines (e.g., "1993\n  年" -> "1993年", "于\n  1993" -> "于1993")
  cleaned = cleaned.replace(/(\d)\s*[\r\n]+\s*(?=[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])/g, '$1')
  cleaned = cleaned.replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])\s*[\r\n]+\s*(?=\d)/g, '$1')

  // 4. Join hyphenated words broken across newlines (e.g., "adminis-\n  tration" -> "administration")
  cleaned = cleaned.replace(/([a-zA-Z])-\s*[\r\n]+\s*([a-zA-Z])/g, '$1$2')

  // 5. Fix orphaned punctuation separated by newlines (e.g. "debate\n." -> "debate.")
  cleaned = cleaned.replace(/\s*[\r\n]+\s*([.,;:?!，。；：？！\u3000-\u303f\uff00-\uffef])/g, '$1')

  // 6. For Chinese text, join English words adjacent to CJK across newlines (e.g. "Trump\n  政府" -> "Trump政府")
  if (!isEnglish) {
    cleaned = cleaned.replace(/([a-zA-Z])\s*[\r\n]+\s*(?=[\u4e00-\u9fa5])/g, '$1')
    cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s*[\r\n]+\s*(?=[a-zA-Z])/g, '$1')
  }

  // 7. Join English words broken across newlines with a single space
  cleaned = cleaned.replace(/([a-zA-Z])\s*[\r\n]+\s*([a-zA-Z])/g, '$1 $2')

  // 8. Replace any remaining newlines
  if (isEnglish) {
    cleaned = cleaned.replace(/[\r\n]+/g, ' ')
  } else {
    // In Chinese text, newlines should not introduce artificial spaces
    cleaned = cleaned.replace(/[\r\n]+/g, '')
  }

  // 9. Join consecutive CJK characters separated by spaces (e.g. "卡 什 · 帕 特 尔" -> "卡什·帕特尔")
  cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')

  // 10. In Chinese text, repair 4-digit years accidentally separated by spaces before "年" (e.g. "199 3年" -> "1993年", "202 4年" -> "2024年")
  if (!isEnglish) {
    cleaned = cleaned.replace(/(18\d|19\d|20\d)\s+(\d)\s*(?=[年月日\-/])/g, '$1$2')
    cleaned = cleaned.replace(/(18|19|20)\s+(\d{2})\s*(?=[年月日\-/])/g, '$1$2')
    cleaned = cleaned.replace(/(\d+)\s+(?=[\u4e00-\u9fa5])/g, '$1')
    cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+(?=\d)/g, '$1')
    cleaned = cleaned.replace(/(18\d|19\d|20\d)\s+(\d)(?=年)/g, '$1$2')
    cleaned = cleaned.replace(/(18|19|20)\s+(\d{2})(?=年)/g, '$1$2')
  } else {
    // In English text, repair split 4-digit years (e.g. "199 3" -> "1993")
    cleaned = cleaned.replace(/\b(18\d|19\d|20\d)\s+(\d)\b/g, '$1$2')
    cleaned = cleaned.replace(/\b(18|19|20)\s+(\d{2})\b/g, '$1$2')
  }

  // 11. Remove spaces between CJK characters and punctuation, or between CJK punctuation marks
  cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+(?=[，。！？；：、“”‘’（）《》·])/g, '$1')
  cleaned = cleaned.replace(/([，。！？；：、“”‘’（）《》·])\s+(?=[\u4e00-\u9fa5])/g, '$1')
  cleaned = cleaned.replace(/([，。！？；：、“”‘’（）《》·])\s+(?=[，。！？；：、“”‘’（）《》·])/g, '$1')

  // 12. Remove stray horizontal whitespace before punctuation marks (e.g. "word ." -> "word.")
  cleaned = cleaned.replace(/(\S)[ \t]+([.,;:?!，。；：？！])/g, '$1$2')

  // 13. Collapse multiple dots
  cleaned = cleaned.replace(/\.{4,}/g, '...')
  cleaned = cleaned.replace(/(?<!\.)\.\.(?!\.)/g, '.')

  // 14. Collapse multiple spaces into one space
  cleaned = cleaned.replace(/[ \t]+/g, ' ')

  return cleaned.trim()
}

export const GLOSSARY_FIELD_ALIASES: Record<'term_cn' | 'term_en' | 'def_cn' | 'def_en', string[]> = {
  term_cn: ['term_cn', 'termCn', 'term_zh', 'chinese_term', 'term_chinese', 'chineseTerm', 'chinese', 'term cn', 'term_ cn', 'term-cn', 'chinese term', '中文术语', '中文'],
  term_en: ['term_en', 'termEn', 'english_term', 'term_english', 'englishTerm', 'english', 'term', 'term en', 'term_ en', 'term-en', 'english term', '英文术语', '英文'],
  def_cn: ['def_cn', 'defCn', 'def_zh', 'chinese_def', 'def_chinese', 'chineseDef', 'definition_cn', 'definition_zh', 'chinese_definition', 'def cn', 'def_ cn', 'def-cn', 'chinese def', 'definition cn', 'chinese definition', 'explanation_cn', 'explanation cn', 'explanation_zh', 'meaning_cn', 'meaning cn', 'meaning_zh', '中文定义', '中文解释', '中文释义'],
  def_en: ['def_en', 'defEn', 'english_def', 'def_english', 'englishDef', 'definition_en', 'english_definition', 'definition', 'def en', 'def_ en', 'def-en', 'english def', 'definition en', 'english definition', 'explanation_en', 'explanation en', 'explanation', 'meaning_en', 'meaning en', 'meaning', '英文定义', '英文解释', '英文释义']
}

export function getGlossaryField(data: any, aliases: string[]): string {
  if (!data || typeof data !== 'object') return ''

  // 1. Direct key match
  for (const alias of aliases) {
    if (data[alias] !== undefined && data[alias] !== null && String(data[alias]).trim() !== '') {
      return String(data[alias]).trim()
    }
  }

  // 2. Normalized key match (case-insensitive, ignoring underscores, spaces, hyphens, and quotes)
  const normalizedDataKeys = new Map<string, string>()
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const normKey = key.toLowerCase().replace(/[\s_\-.*`'"]+/g, '')
      if (!normalizedDataKeys.has(normKey)) {
        normalizedDataKeys.set(normKey, String(val).trim())
      }
    }
  }

  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[\s_\-.*`'"]+/g, '')
    if (normalizedDataKeys.has(normAlias)) {
      return normalizedDataKeys.get(normAlias)!
    }
  }

  return ''
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
        `(?:^|[\\r\\n,{]\\s*)[*"-]*\\s*${escapedAlias}\\s*[*"-]*\\s*[:=]\\s*(?:"|'|“)?([\\s\\S]*?)(?=(?:["'”]?\\s*[,;\\r\\n]+\\s*[*"-]*\\s*(?:${allAliasesPattern}|[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_ \t\u4e00-\u9fa5-]*)\\s*[*"-]*\\s*[:=])|["'”]?\\s*\\}\\s*$|$)`,
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

  // 3. Pre-repair broken JSON keys across newlines or spaces (e.g. "def_\n  en": -> "def_en":, "def_ en": -> "def_en":, "term  cn": -> "term_cn":)
  cleaned = cleaned.replace(/(["']?)(def|term|definition|explanation|meaning)[_\s-]*[\r\n]*[_\s-]*(en|cn|zh)\1\s*:/gi, '"$2_$3":')
  cleaned = cleaned.replace(/(["']?)(chinese|english)[_\s-]*[\r\n]*[_\s-]*(term|def|definition|explanation|meaning)\1\s*:/gi, '"$2_$3":')
  cleaned = cleaned.replace(/(["']?)(def|term)\s+([a-zA-Z0-9_\u4e00-\u9fa5]+)\1\s*:/gi, '"$2_$3":')

  let data: any = null

  // 4. Try standard JSON.parse
  try {
    data = JSON.parse(cleaned)
  } catch {}

  // 5. Try escaping unescaped newlines/control characters/internal quotes
  if (!data) {
    try {
      const escaped = escapeUnescapedControlCharsInJson(cleaned)
      data = JSON.parse(escaped)
    } catch {}
  }

  // 6. Try lenient sanitization (trailing commas, quotes, etc.)
  if (!data) {
    try {
      const sanitized = sanitizeLenientJson(escapeUnescapedControlCharsInJson(cleaned))
      data = JSON.parse(sanitized)
    } catch {}
  }

  // 7. Regex field extraction fallback for unquoted / markdown / malformed responses
  if (!data || typeof data !== 'object') {
    data = extractGlossaryFieldsFromText(cleaned)
  }

  if (!data) return null

  let termCn = getGlossaryField(data, GLOSSARY_FIELD_ALIASES.term_cn)
  let termEn = getGlossaryField(data, GLOSSARY_FIELD_ALIASES.term_en)
  let defCn = getGlossaryField(data, GLOSSARY_FIELD_ALIASES.def_cn)
  let defEn = getGlossaryField(data, GLOSSARY_FIELD_ALIASES.def_en)

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

  // Fallback to userTerm if one of the language terms is missing and matches userTerm language
  if (!termEn && userTerm && !/[\u4e00-\u9fa5]/.test(userTerm)) {
    termEn = userTerm.trim()
  }
  if (!termCn && userTerm && /[\u4e00-\u9fa5]/.test(userTerm)) {
    termCn = userTerm.trim()
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

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export interface AiCallOptions {
  messages?: AiMessage[]
  system?: string
  user?: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
  prompt?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'json_object' } | null
  timeoutMs?: number
}

// Shared API call logic with structured output fallback and role separation
export async function callAiApi(
  request: string | AiCallOptions,
  settings: Record<string, string>,
  extraOptions?: Partial<AiCallOptions>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const options: AiCallOptions = typeof request === 'string'
    ? { prompt: request, ...extraOptions }
    : { ...request, ...extraOptions }

  const apiKey = (settings['aiKey'] || '').trim()
  let apiUrl = (settings['aiUrl'] || 'https://api.openai.com/v1').trim()
  const model = (settings['aiModel'] || 'gpt-4o').trim()

  if (!apiKey) {
    return { success: false, error: 'AI API Key is not configured in Settings.' }
  }

  // Normalize API URL: remove trailing slashes first, then ensure it ends with /chat/completions
  apiUrl = apiUrl.replace(/\/+$/, '')
  if (!apiUrl.endsWith('/chat/completions')) {
    apiUrl += '/chat/completions'
  }

  let messages: AiMessage[] = []
  if (options.messages && options.messages.length > 0) {
    messages = options.messages.map(m => ({ ...m }))
  } else {
    if (options.system && options.system.trim()) {
      messages.push({ role: 'system', content: options.system.trim() })
    }
    if (options.user !== undefined && options.user !== null) {
      messages.push({ role: 'user', content: options.user })
    } else if (options.prompt) {
      messages.push({ role: 'user', content: options.prompt })
    }
  }

  if (messages.length === 0) {
    return { success: false, error: 'No prompt or messages provided for AI request.' }
  }

  let currentResponseFormat = options.responseFormat || null

  // Ensure JSON keyword appears in prompt if json_object response format is active (OpenAI constraint)
  if (currentResponseFormat && currentResponseFormat.type === 'json_object') {
    const hasJsonWord = messages.some(m => {
      if (typeof m.content === 'string') {
        return /json/i.test(m.content)
      }
      if (Array.isArray(m.content)) {
        return m.content.some(part => part.type === 'text' && /json/i.test(part.text))
      }
      return false
    })
    if (!hasJsonWord) {
      if (messages[0] && typeof messages[0].content === 'string') {
        messages[0] = { ...messages[0], content: messages[0].content + '\nYou must respond in valid JSON format.' }
      } else {
        messages.unshift({ role: 'system', content: 'You must respond in valid JSON format.' })
      }
    }
  }

  const timeoutMs = options.timeoutMs || 60000
  const temperature = options.temperature !== undefined ? options.temperature : 0.7
  const maxTokens = options.maxTokens || 2000

  let lastError: any = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const payload: any = {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      }
      if (currentResponseFormat) {
        payload.response_format = currentResponseFormat
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (!response.ok) {
        const errorData = await response.text()

        // Fallback retry: If HTTP 400 or 422 occurred while response_format was active,
        // retry immediately without response_format to accommodate custom proxies or models that don't support JSON mode.
        if ((response.status === 400 || response.status === 422) && currentResponseFormat) {
          console.warn(`[AI API] Received HTTP ${response.status} with response_format (${errorData}). Retrying without response_format...`)
          currentResponseFormat = null
          const fallbackPayload = { ...payload }
          delete fallbackPayload.response_format

          try {
            const fallbackResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(fallbackPayload),
              signal: AbortSignal.timeout(timeoutMs)
            })

            if (!fallbackResponse.ok) {
              const fallbackError = await fallbackResponse.text()
              return { success: false, error: `API Error (${fallbackResponse.status}): ${fallbackError}` }
            }

            const fallbackData = await fallbackResponse.json()
            const fallbackResult = fallbackData.choices?.[0]?.message?.content?.trim()
            if (!fallbackResult) {
              const fallbackErrMsg = fallbackData.error?.message || fallbackData.error || 'API returned an empty response.'
              return { success: false, error: typeof fallbackErrMsg === 'string' ? fallbackErrMsg : JSON.stringify(fallbackErrMsg) }
            }
            return { success: true, result: fallbackResult }
          } catch (fallbackErr: any) {
            lastError = fallbackErr
            if (attempt === 0) {
              await new Promise(r => setTimeout(r, 2000))
              continue
            }
          }
        }

        // Retry on transient server errors or rate limits on attempt 0
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          lastError = new Error(`API Error (${response.status}): ${errorData}`)
          await new Promise(r => setTimeout(r, 2000))
          continue
        }

        return { success: false, error: `API Error (${response.status}): ${errorData}` }
      }

      const data = await response.json()
      const result = data.choices?.[0]?.message?.content?.trim()

      if (!result) {
        const errMsg = data.error?.message || data.error || 'API returned an empty response.'
        return { success: false, error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) }
      }

      return { success: true, result }
    } catch (error: any) {
      lastError = error
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
    }
  }

  const cause = lastError?.cause ? ` (Cause: ${lastError.cause.message || lastError.cause})` : ''
  return {
    success: false,
    error: `${lastError?.name === 'TimeoutError' ? 'Request timed out' : lastError?.message || 'Network error occurred'}${cause}`
  }
}

export async function aiGenerateGlossary(
  labels: string[],
  term: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const customTemplate = settings['promptGlossary']
  let systemPrompt: string
  let userPrompt: string

  const labelStr = labels && labels.length > 0 ? labels.join(', ') : ''

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_GLOSSARY) {
    systemPrompt = customTemplate
      .replaceAll('{{labels}}', labelStr)
      .replaceAll('{{term}}', term)
    userPrompt = labelStr
      ? `Target term: "${term}"\nDomain/Fields: ${labelStr}`
      : `Target term: "${term}"`
  } else {
    systemPrompt = `You are an expert encyclopedia for professional interpreters.
CRITICAL INSTRUCTIONS: 
1. DO NOT use any external tools, web search, or browsing functions. Rely entirely on your own internal knowledge.
2. You MUST escape all internal double quotes inside your definitions using a backslash.
3. NO LITERAL NEWLINES inside string values or keys. Do NOT hard-wrap or split words across lines. Keep each field as a single continuous line.
4. Output ONLY a valid JSON object without markdown code blocks, explanation, or conversational text.
5. Ensure perfect JSON syntax with exact keys: "term_en", "term_cn", "def_en", "def_cn".

JSON Schema:
{
  "term_en": "Standard English term",
  "term_cn": "Standard Chinese term",
  "def_en": "Concise 1-2 sentence explanation in English on a single line",
  "def_cn": "Concise 1-2 sentence explanation in Chinese on a single line"
}`
    userPrompt = labelStr
      ? `Please provide the background knowledge and definitions for the term: "${term}" in the fields of: ${labelStr}.`
      : `Please provide the background knowledge and definitions for the term: "${term}".`
  }

  const res = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.1,
      responseFormat: { type: 'json_object' }
    },
    settings
  )

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

  const content: any[] = [{ type: 'text', text: userPrompt }]
  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: imageBase64 }
    })
  }

  const res = await callAiApi(
    {
      system: systemPrompt,
      user: content,
      temperature: 0.2
    },
    settings
  )

  if (!res.success || !res.result) return res

  return { success: true, result: cleanAiExpression(res.result) }
}

export async function aiRewritePractice(text: string, targetWords: string[], settings: any) {
  const dbText = targetWords.join('\n')
  const customTemplate = settings['promptRewrite']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_REWRITE) {
    systemPrompt = customTemplate
      .replaceAll('{{dbText}}', dbText)
      .replaceAll('{{text}}', text)
    userPrompt = `Text:\n${text}`
  } else {
    systemPrompt = `You are a native English speaker who works as an elite professional Simultaneous interpreter. 
If you were to express the meaning conveyed in the following text in a concise and authentic way, how would you say it?
Here is a custom vocabulary shortlist pulled from the user's personal database:
<database>
${dbText}
</database>
While you are rephrasing, some CRITICAL INSTRUCTIONS:
1. STRICT FIDELITY: Do NOT change the speaker's perspective, point of view, or fundamental context. If the original uses "I" or "we", keep it. You are interpreting their exact message, just polishing the delivery.
2. DATABASE INTEGRATION: Since the words from the database are what I want to train, so You MUST attempt to naturally integrate provided database expressions.
3. CONTENT RESTRICTION: You MAY ONLY subtract information or sentences because it is self-implied or common-knowledge according to the context. But you MUSTN'T add information that you cannot guarantee accuracy.`
    userPrompt = `Text:\n${text}`
  }

  return callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.7
    },
    settings
  )
}

// Unused generation (Ready Versions is direct input only per PDF)
export async function aiGenerateReadyVersion(
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  return { success: false, error: 'Ready Versions do not use AI.' }
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
  cleaned = cleaned.replace(/\s*[\r\n]+\s*([.,;:?!，。；：？！\u3000-\u303f\uff00-\uffef])/g, '$1')

  // 8. Join hyphenated words broken across newlines (e.g. "adminis-\n  tration" -> "administration")
  cleaned = cleaned.replace(/([a-zA-Z])-\s*[\r\n]+\s*([a-zA-Z])/g, '$1$2')

  // 9. Join digits broken across newlines (e.g. "199\n  3" -> "1993")
  cleaned = cleaned.replace(/(\d)\s*[\r\n]+\s*(?=\d)/g, '$1')

  // 10. Join CJK characters and numbers broken across newlines
  cleaned = cleaned.replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])\s*[\r\n]+\s*(?=[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])/g, '$1')
  cleaned = cleaned.replace(/(\d)\s*[\r\n]+\s*(?=[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])/g, '$1')
  cleaned = cleaned.replace(/([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])\s*[\r\n]+\s*(?=\d)/g, '$1')

  // 11. Repair split 4-digit years (e.g. "199 3" -> "1993")
  cleaned = cleaned.replace(/\b(18\d|19\d|20\d)\s+(\d)\b/g, '$1$2')
  cleaned = cleaned.replace(/\b(18|19|20)\s+(\d{2})\b/g, '$1$2')

  // 12. Remove stray horizontal whitespace before punctuation marks (e.g. "debate ." -> "debate.")
  cleaned = cleaned.replace(/(\S)[ \t]+([.,;:?!，。；：？！])/g, '$1$2')

  // 12. Collapse all remaining newlines into a single space (concise definitions should not contain artificial soft wraps)
  cleaned = cleaned.replace(/\s*[\r\n]+\s*/g, ' ')

  // 13. Collapse accidental duplicate dots/commas (preserving standard ellipsis "...")
  cleaned = cleaned.replace(/([,;:?!，。；：？！])\1+/g, '$1')
  cleaned = cleaned.replace(/\.{4,}/g, '...')
  cleaned = cleaned.replace(/(?<!\.)\.\.(?!\.)/g, '.')

  // 14. Re-strip surrounding/lone quotes in case punctuation or newline cleanup exposed them
  cleaned = stripWrappingQuotes(cleaned)

  // 15. Clean excess horizontal whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' ').trim()

  return cleaned
}

export async function aiGenerateExpression(
  context: string,
  style: string,
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const customTemplate = settings['promptExpression']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_EXPRESSION) {
    systemPrompt = customTemplate
      .replaceAll('{{front}}', front)
      .replaceAll('{{context}}', context)
    userPrompt = `Target expression: "${front}"\nContext: "${context}"`
  } else {
    systemPrompt = `Task: Provide a concise English definition for the target expression based on the provided context.
STRICT RULE: Do NOT use the target expression in the definition and DO NOT provide detailed explanation of how the word means inside the context.
OUTPUT FORMAT: Output ONLY the concise definition text directly on a single line. Do NOT wrap in quotes or code blocks, and do NOT place punctuation marks on separate lines.`
    userPrompt = `Target expression: "${front}"\nContext: "${context}"`
  }

  const res = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.2
    },
    settings
  )
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

  const customTemplate = settings['promptRevisionCloze']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_REVISION_CLOZE) {
    systemPrompt = customTemplate
      .replaceAll('{{display_phrase}}', display_phrase)
      .replaceAll('{{back}}', back)
      .replaceAll('{{clean_snippet}}', clean_snippet)
      .replaceAll('{{wordsToBlank}}', wordsToBlank)
    userPrompt = `<target_phrase>${display_phrase}</target_phrase>\n<definition>${back}</definition>\n<corpus_snippet>${clean_snippet}</corpus_snippet>\n<words_to_blank>[${wordsToBlank}]</words_to_blank>`
  } else {
    systemPrompt = `You are an educational AI assistant helping an interpreting student learn English vocabulary.
<task>
Paraphrase the provided corpus snippet into a simple context (1 to 3 sentences). 
You must retain the exact target phrase in your rewritten context.
</task>
<rules>
1. SEMANTIC HINTS: The context must clearly hint at the meaning of the target phrase, making it the only logical answer.
2. RETAIN TARGET: Keep the exact target phrase and its immediate collocations intact.
3. CLOZE DELETION: You MUST replace the specific words in your rewritten context that correspond to the following core words with "________" (8 underscores). You must also replace any inflected forms of these words (e.g., if the core word is "play", replace "playing" or "played"). Do not replace pronouns, articles or filler words like "one's", "sb", "sth" unless they are in the brackets.
4. STRICT OUTPUT: Output ONLY the rewritten English paragraph with the blanks. Do not include conversational filler, intros, or markdown blocks.
5. NO TRANSFORMATION ARROWS: Do NOT output token-by-token transformation mappings, word lists, or arrows (e.g. NEVER output "word" -> "______"). Return ONLY the complete, natural rewritten paragraph/sentence with the target blanks embedded in context.
</rules>`
    userPrompt = `<target_phrase>${display_phrase}</target_phrase>
<definition>${back}</definition>
<corpus_snippet>
${clean_snippet}
</corpus_snippet>
<words_to_blank>[${wordsToBlank}]</words_to_blank>`
  }

  const aiRes = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3
    },
    settings
  )
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
  const customTemplate = settings['promptPureListener']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_PURE_LISTENER) {
    systemPrompt = customTemplate.replaceAll('{{text}}', text)
    userPrompt = `<input_text>\n${text}\n</input_text>`
  } else {
    systemPrompt = `You are a "Pure Listener". I am an interpreting student. I will provide you with a text that I produced.
<task>
Read the text carefully. Then, provide feedback on the overall logic, structure, and clarity of the message. 
Summarize the main idea and point out any logical gaps or contradictions.
</task>
<rules>
1. "ALL CLEAR" RULE: You are STRICTLY FORBIDDEN from correcting grammar, vocabulary, collocations, or style. 
2. You MUST NOT suggest better words or point out grammatical mistakes. Only focus on the broad message and logic.
3. Your feedback MUST be in the exact same language as my input text.
</rules>`
    userPrompt = `<input_text>\n${text}\n</input_text>`
  }

  const aiRes = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.5
    },
    settings
  )
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

  const customTemplate = settings['promptPracticeRewrite']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_PRACTICE_REWRITE) {
    systemPrompt = customTemplate
      .replaceAll('{{vocabulary_bank}}', vocabBankStr)
      .replaceAll('{{vocabularyBank}}', vocabBankStr)
      .replaceAll('{{cardsContext}}', vocabBankStr)
      .replaceAll('{{replacementsContext}}', vocabBankStr)
      .replaceAll('{{text}}', text)
      .replaceAll('{{input_text}}', text)
    userPrompt = `<input_text>\n${text}\n</input_text>`
  } else {
    systemPrompt = `You are an expert English editor and simultaneous interpreter.
<task>
Rewrite the input text to make it more natural, idiomatic, and professional by integrating authentic expressions from the provided vocabulary bank.
</task>

<vocabulary_bank>
${vocabBankStr}
</vocabulary_bank>

<rules>
1. CONSTRAINED SUBSTITUTION: You may ONLY substitute original segments with expressions from the <vocabulary_bank> where they genuinely, naturally, and authentically fit the speaker's intent and sentence context.
2. DO NOT FORCE SUBSTITUTIONS: If an expression does not fit naturally, do NOT use it. If NO expressions fit authentically, keep the original text structure and meaning intact with minimal or no changes.
3. PRESERVE PERSPECTIVE & MEANING: Keep the author's original perspective, voice, and core meaning completely intact. Adapt grammatical inflections (tense, agreement, prepositions) only as strictly needed for natural English syntax.
4. EXPLICIT INLINE TAGGING: Whenever you integrate an expression from the <vocabulary_bank>, wrap that integrated expression (in whatever grammatical form or inflection you used) with an inline tag: <mark id="CARD_ID">inflected expression</mark>, where CARD_ID matches the ID from the <vocabulary_bank>.
Example: If integrating card with ID 101 ("double down on"), write:
"The committee decided to <mark id="101">double down on</mark> their renewable energy commitment."
Do not tag any words or expressions that were not derived from that vocabulary bank card.
5. RESPONSE FORMAT: You MUST return a single valid raw JSON object with NO surrounding markdown formatting or commentary.
JSON schema:
{
  "rewritten_text": "The final rewritten text with integrated expressions wrapped in <mark id=\\"ID\\">...</mark>",
  "used_card_ids": [101, 105]
}
If no expressions from the vocabulary bank qualify or fit, return the original text in "rewritten_text" (without mark tags) and an empty array [] in "used_card_ids".
</rules>`
    userPrompt = `<input_text>\n${text}\n</input_text>`
  }

  const aiRes = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.2,
      responseFormat: { type: 'json_object' }
    },
    settings
  )
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

  const codeMatch = rewrittenText.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/)
  if (codeMatch) {
    rewrittenText = codeMatch[1].trim()
  }

  if (rewrittenText.startsWith('"') && rewrittenText.endsWith('"') && rewrittenText.length >= 2) {
    rewrittenText = rewrittenText.slice(1, -1).trim()
  }

  // 1. Explicit Inline Markup Parsing (Ground Truth Tagging)
  const allLibraryCards = (dbHandlers.getCards ? dbHandlers.getCards() : allCards) || []
  const markResult = parseMarkedText(rewrittenText, candidateCards, allLibraryCards)

  let cleanRewrittenText: string
  let finalCards: any[] = []
  let finalSegments: TextSegment[] = []

  if (markResult.cards.length > 0) {
    // Model provided explicit <mark id="..."> tags
    cleanRewrittenText = markResult.cleanText
    finalCards = [...markResult.cards]
    finalSegments = markResult.segments

    // Also include any candidate cards declared in used_card_ids
    const existingIdSet = new Set<number>(finalCards.map(c => c.id))
    for (const cardId of usedCardIds) {
      if (!existingIdSet.has(cardId)) {
        const found = candidateCards.find(c => c.id === cardId)
        if (found) {
          existingIdSet.add(found.id)
          finalCards.push(found)
        }
      }
    }

    // Segment any declared or fallback cards from finalCards across the plain-text spans of finalSegments
    const unsegmentedCards = finalCards.filter(c => !finalSegments.some(s => s.card?.id === c.id))
    if (unsegmentedCards.length > 0) {
      const updatedSegments: TextSegment[] = []
      for (const seg of finalSegments) {
        if (seg.card) {
          updatedSegments.push(seg)
        } else if (seg.text) {
          const subSegs = segmentTextWithCards(seg.text, unsegmentedCards)
          updatedSegments.push(...subSegs)
        }
      }
      // Re-merge adjacent plain-text segments
      const remerged: TextSegment[] = []
      for (const seg of updatedSegments) {
        if (!seg.text) continue
        if (remerged.length > 0 && remerged[remerged.length - 1].card === null && seg.card === null) {
          remerged[remerged.length - 1].text += seg.text
        } else {
          remerged.push(seg)
        }
      }
      finalSegments = remerged
    }
  } else {
    // Model omitted mark tags (plain text or legacy prompt output)
    cleanRewrittenText = markResult.cleanText || rewrittenText

    const usedIdSet = new Set(usedCardIds)
    finalCards = candidateCards.filter(c => usedIdSet.has(c.id))

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

    // Scoped regex matching within candidateCards ONLY (strictly no full-library blind scan)
    const checkedCardIds = new Set<number>(finalCards.map(c => c.id))
    if (candidateCards && candidateCards.length > 0) {
      for (const card of candidateCards) {
        if (checkedCardIds.has(card.id)) continue
        checkedCardIds.add(card.id)
        if (isCardInText(card, cleanRewrittenText)) {
          finalCards.push(card)
        }
      }
    }

    finalSegments = segmentTextWithCards(cleanRewrittenText, finalCards)
  }

  return {
    success: true,
    result: {
      text: cleanRewrittenText,
      cards: finalCards,
      segments: finalSegments
    }
  }
}

export async function practiceAiVersion(text: string, settings: any) {
  const customTemplate = settings['promptAiVersion']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_AI_VERSION) {
    systemPrompt = customTemplate.replaceAll('{{text}}', text)
    userPrompt = `<input_text>\n${text}\n</input_text>`
  } else {
    systemPrompt = `You are an elite, professional conference interpreter.
<task>
Reinterpret the following transcript into a flawless, concise, native, and highly idiomatic delivery.
</task>
<rules>
- Maintain the exact original core message.
- Express the meaning in a concise and native way.
- Prioritize phrasal verbs or idioms if they are relevant and appropriate.
- Prioritize verbs over nouns, words or phrases over clauses.
- Your register should be semi-formal and colloquial unless the text is a formal speech of serious topics.
- DO NOT provide explanations or commentary. Return ONLY the polished interpretation.
- Respond in the exact same language as the transcript.
</rules>`
    userPrompt = `<input_text>\n${text}\n</input_text>`
  }

  const aiRes = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.7
    },
    settings
  )
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

  const customTemplate = settings['promptSynonyms']
  let systemPrompt: string
  let userPrompt: string

  if (customTemplate && customTemplate !== DEFAULT_PROMPT_SYNONYMS) {
    systemPrompt = customTemplate
      .replaceAll('{{targetFront}}', targetFront)
      .replaceAll('{{targetBack}}', targetBack)
      .replaceAll('{{context}}', context || '')
      .replaceAll('{{targetContext}}', context || '')
      .replaceAll('{{candidatesStr}}', candidatesStr)
    userPrompt = `Target Word: "${targetFront}"\nDefinition: "${targetBack}"\nGiven Context: "${context}"\n\nCandidates:\n${candidatesStr}`
  } else {
    systemPrompt = `You are an expert lexicographer. Your task is to identify valid synonyms for a Target Word from a provided list of Candidates.
EVALUATION CRITERIA:
To be selected, a candidate MUST meet ALL of the following criteria:
1. Core Semantic Overlap: The candidate must represent the same fundamental action, state, or concept. Minor nuances in motivation, intensity, or flavor are FULLY ACCEPTABLE (e.g., "play the contrarian" and "play devil's advocate" are valid synonyms despite nuanced differences in intent).
2. Contextual Paraphrase: The selected candidate must be one with which the given context can be paraphrased or rewritten while preserving the core message(s).
3. Strict Concept Boundary: The candidate MUST NOT be a cause, consequence, merely related topic, or antonym. (e.g., if the target is "happy", "joyful" is valid, but "serendipity" is INVALID because serendipity is a lucky event that *causes* happiness, not the emotion itself).
OUTPUT FORMAT:
Return a raw JSON array containing ONLY the string IDs of the selected candidates. Do not provide any conversational filler, markdown formatting, or explanations.
Example: ["1", "5", "8"]`
    userPrompt = `Target Word: "${targetFront}"
Definition: "${targetBack}"
Given Context: "${context}"

Candidates:
${candidatesStr}`
  }

  const aiRes = await callAiApi(
    {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.1
    },
    settings
  )
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to filter synonyms: ' + (aiRes.error || 'Empty response') }
  }

  const ids = extractJsonArray(aiRes.result)
  if (ids !== null) {
    return { success: true, result: ids }
  }

  return { success: false, error: 'Failed to parse AI response as JSON array: ' + aiRes.result }
}
