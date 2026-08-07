import fs from 'fs'
import path from 'path'
import { getImagesDir } from './imageCache'

export async function aiGenerateGlossary(
  labels: string[],
  term: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const prompt = `You are an expert encyclopedia for professional interpreters.
The user wants to know the background knowledge for this term: "${term}" in the fields of ${labels.join(', ')}
CRITICAL INSTRUCTIONS: 
1. DO NOT use any external tools, web search, or browsing functions. Rely entirely on your own internal knowledge.
2. You MUST escape all double quotes inside your definitions using a backslash 
3. NO LITERAL NEWLINES. If you need a line break in your definition, type "\\n" literally
4. Ensure perfect JSON syntax.
Provide a raw JSON response exactly in this format:
{
"term_en": "Standard English term",
"term_cn": "Standard Chinese term",
"def_en": "Concise 1-2 line explanation in English",
"def_cn": "Concise 1-2 line explanation in Chinese"
}`
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

  const systemPrompt = `You are an expert bilingual linguist and localization specialist. Your task is to analyze the input to find its best-fit, authentic, natural English counterpart(s).
The counterpart(s) in English should:
1. Arouse the same image or convey the same message as it does with Chinese or with the picture
2. Be legible and make sense across general anglosphere, not only a specific culture
3. Contemporary English should be highly preferrable, and Internet Slangs are also acceptable in certain cases. Words or expressions that are marked Literary, archaic, biblical, old-fashioned are only acceptable when (1) the Chinese or the picture is itself Literary, archaic, biblical, old-fashioned; (2) they can be a certain rhetorical device.`

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
  const prompt = `You are an elite, professional conference interpreter. Reinterpret the following transcript into a flawless, concise, native, and highly idiomatic delivery.
CRITICAL INSTRUCTIONS:
- Maintain the exact original core message.
- Express the meaning in a highly concise and native way.
- Use situation-relevant and idiomatic expressions naturally.
- Adjust your register (formal, semi-formal, etc.) based appropriately on the implied theme and topic of the text.
- DO NOT provide explanations or commentary. Return ONLY the polished interpretation.
- Respond in the exact same language as the transcript.

Source Text:
${text}`
  
  return callAiApi(prompt, settings)
}

export async function aiRewritePractice(text: string, targetWords: string[], settings: any) {
  const dbText = targetWords.join('\n')
  const prompt = `You are a native English speaker who works as an elite professional Simultaneous interpreter. 
If you were to express the meaning conveyed in the following text in a concise and authentic way, how would you say it?
Here is a custom vocabulary shortlist pulled from the user's personal database:
<database>
${dbText}
</database>
While you are rephrasing, some CRITICAL INSTRUCTIONS:
1. STRICT FIDELITY: Do NOT change the speaker's perspective, point of view, or fundamental context. If the original uses "I" or "we", keep it. You are interpreting their exact message, just polishing the delivery.
2. DATABASE INTEGRATION: Since the words from the database are what I want to train, so You MUST attempt to naturally integrate provided database expressions.
3. CONTENT RESTRICTION: You MAY ONLY subtract information or sentences because it is self-implied or common-knowledge according to the context. But you MUSTN'T add information that you cannot guarantee accuracy.

Text:
${text}`

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
      })
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
    return { success: false, error: error.message || 'Network error occurred.' }
  }
}

export async function aiGenerateExpression(
  context: string,
  style: string,
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const prompt = `Task: Provide a concise English definition for "${front}" based on context: "${context}".
STRICT RULE: Do NOT use the word "${front}" in the definition and DO NOT provide detailed explanation of how the word means inside the context.`

  return await callAiApi(prompt, settings)
}
