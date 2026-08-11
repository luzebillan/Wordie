import fs from 'fs'
import path from 'path'
import { getImagesDir } from './imageCache'

import { 
  DEFAULT_PROMPT_GLOSSARY,
  DEFAULT_PROMPT_DAILY_WORD,
  DEFAULT_PROMPT_PRACTICE_AI,
  DEFAULT_PROMPT_REWRITE,
  DEFAULT_PROMPT_EXPRESSION,
  DEFAULT_PROMPT_REVISION_CLOZE,
  DEFAULT_PROMPT_PURE_LISTENER,
  DEFAULT_PROMPT_PRACTICE_EXTRACT,
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
        max_tokens: 500
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

export async function aiPracticeAIVersion(text: string, settings: any) {
  const template = settings['promptPracticeAi'] || DEFAULT_PROMPT_PRACTICE_AI
  const prompt = template.replace('{{text}}', text)
  
  return callAiApi(prompt, settings)
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
          max_tokens: 500
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

  // 1. Format phrase
  let clean_phrase = front.replace(/\*/g, " ").toLowerCase()
  const placeholders = ["someone", "something", "sb.", "sb", "sth.", "sth", "one's", "ones", "oneself", "be"]
  
  for (const p of placeholders) {
    const escaped_p = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?<![a-z])${escaped_p}(?![a-z])`, 'g')
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
      if (w.endsWith('s') || w.endsWith('ing') || w.endsWith('ed') || w.endsWith('d') || w.endsWith('es') || w.endsWith('en') || w.endsWith('ought') || w.endsWith('own')) {
        cql_tokens.push(`[word="(?i)${w}"]`)
      } else {
        cql_tokens.push(`[lemma_lc="${w}"]`)
      }
    })
    
    if (i < parts.length - 1 && words.length > 0) {
      cql_tokens.push('[]{1,2}')
    }
  })
  
  const cql_query = cql_tokens.join(' ')
  
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

  const wordsToBlank = search_words.join(', ')

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

export async function practiceRewrite(text: string, settings: any, dbHandlers: any) {
  // 1. Extract expressions to optimize
  const rewriteDivider = parseInt(settings.rewriteDivider || '20', 10)
  const allCards = dbHandlers.searchCards('', 'Useful Expression')
  const totalCards = allCards.length
  
  if (totalCards === 0) {
    return { success: false, error: 'Your database is empty. Add some Useful Expressions first!' }
  }

  const targetCount = Math.max(3, Math.ceil(totalCards / rewriteDivider))

  const extractTemplate = settings['promptPracticeExtract'] || DEFAULT_PROMPT_PRACTICE_EXTRACT
  const extractPrompt = extractTemplate
    .replace('{{targetCount}}', targetCount.toString())
    .replace('{{text}}', text)

  const extractRes = await callAiApi(extractPrompt, settings)
  if (!extractRes.success || !extractRes.result) {
    return { success: false, error: 'AI failed to extract expressions: ' + extractRes.error }
  }

  const phrases = extractRes.result.split('|').map((p: string) => p.trim()).filter((p: string) => p.length > 0)

  // 2. Search for relevant cards
  const matchedCards = new Set<any>()
  
  // Use our local semantic search
  // We'll just search each phrase and take the top result.
  for (const phrase of phrases) {
    const results = await dbHandlers.findSimilarCards(phrase, phrase, 'Useful Expression')
    if (results.length > 0) {
      matchedCards.add(results[0])
    }
  }

  // If we couldn't match enough, pad with random cards
  const finalCards = Array.from(matchedCards)
  while (finalCards.length < targetCount && finalCards.length < totalCards) {
    const randomCard = allCards[Math.floor(Math.random() * allCards.length)]
    if (!finalCards.find(c => c.id === randomCard.id)) {
      finalCards.push(randomCard)
    }
  }

  // 3. Force integrate matched cards
  const cardsContext = finalCards.map(c => `- ${c.front}: ${c.back}`).join('\n')
  
  const rewriteTemplate = settings['promptPracticeRewrite'] || DEFAULT_PROMPT_PRACTICE_REWRITE
  const rewritePrompt = rewriteTemplate
    .replace('{{cardsContext}}', cardsContext)
    .replace('{{text}}', text)

  const rewriteRes = await callAiApi(rewritePrompt, settings)
  if (!rewriteRes.success || !rewriteRes.result) {
    return { success: false, error: 'AI failed to rewrite text: ' + rewriteRes.error }
  }

  return { success: true, result: { text: rewriteRes.result.trim(), cards: finalCards } }
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

export async function aiFilterSynonyms(
  targetFront: string,
  targetBack: string,
  candidates: any[],
  settings: any
): Promise<{ success: boolean; result?: string[]; error?: string }> {
  // Construct candidates string
  const candidatesStr = candidates.map(c => `[ID: ${c.id}] Word: ${c.front}\nDefinition: ${c.back}`).join('\n\n')

  const template = settings['promptSynonyms'] || DEFAULT_PROMPT_SYNONYMS
  const prompt = template
    .replace('{{targetFront}}', targetFront)
    .replace('{{targetBack}}', targetBack)
    .replace('{{candidatesStr}}', candidatesStr)

  const aiRes = await callAiApi(prompt, settings)
  if (!aiRes.success || !aiRes.result) {
    return { success: false, error: 'AI failed to filter synonyms: ' + aiRes.error }
  }

  try {
    let jsonStr = aiRes.result.trim()
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match) {
      jsonStr = match[1]
    }
    const ids = JSON.parse(jsonStr)
    if (!Array.isArray(ids)) throw new Error('Result is not an array')
    // Ensure all IDs are parsed as numbers/strings properly so they match candidate IDs
    return { success: true, result: ids.map(id => String(id)) }
  } catch (err: any) {
    return { success: false, error: 'Failed to parse AI response as JSON array: ' + aiRes.result }
  }
}
