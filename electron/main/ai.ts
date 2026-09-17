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

  try {
    let jsonStr = res.result || ''
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match) {
      jsonStr = match[1]
    }
    const data = JSON.parse(jsonStr)
    const frontStr = `${data.term_cn}\n${data.term_en}`
    const backStr = `${data.def_cn}\n${data.def_en}`
    return { success: true, result: JSON.stringify({ front: frontStr, back: backStr }) }
  } catch (err: any) {
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

    return { success: true, result }
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

  return await callAiApi(prompt, settings)
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

  // Fallback: If no cards matched by ID and model omitted used_card_ids, detect if candidate expressions were newly integrated in rewrittenText
  if ((!parsed || (parsed.used_card_ids === undefined && parsed.usedCardIds === undefined)) && finalCards.length === 0 && candidateCards.length > 0) {
    for (const card of candidateCards) {
      const lines = String(card.front || '').split(/\r?\n/).map(l => l.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
      for (const cleanFront of lines) {
        if (cleanFront.length >= 2 || (cleanFront.length >= 1 && /[\p{Unified_Ideograph}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(cleanFront))) {
          const escapedFront = cleanFront.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`(?<![a-zA-Z0-9])${escapedFront}(?![a-zA-Z0-9])`, 'i')
          if (regex.test(rewrittenText) && !regex.test(text)) {
            if (!finalCards.some(c => c.id === card.id)) {
              finalCards.push(card)
            }
            break
          }
        }
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
