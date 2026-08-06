export async function aiGenerateGlossary(
  domain: string,
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const prompt = `You are an expert bilingual lexicographer.
Target Term: "${front}"
Domain/Field: "${domain || 'General'}"

Please provide a precise bilingual translation and definition for this term in the given domain context.
Format the output clearly. Return ONLY the flashcard back side content.`
  return await callAiApi(prompt, settings)
}

export async function aiGenerateDailyWord(
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const prompt = `You are an expert language teacher.
Target Word: "${front}"

Please provide a simple, common translation, phonetic pronunciation, and one daily life example sentence.
Format the output clearly. Return ONLY the flashcard back side content.`
  return await callAiApi(prompt, settings)
}

export async function aiGenerateReadyVersionSimple(front: string, settings: any) {
  const prompt = `You are an expert bilingual native speaker. The user has provided an idiom, slang, or tricky phrase: "${front}". Provide a natural, native-sounding "ready version" explanation or nuance that captures its essence. Make it concise and highly readable.`
  const systemPrompt = 'Answer in a casual but clear tone. You can use Markdown.'
  
  return callOpenAI(prompt, systemPrompt, settings)
}

export async function aiRewritePractice(text: string, targetWords: string[], settings: any) {
  const wordsList = targetWords.join(', ')
  const prompt = `You are an expert editor. Rewrite the following text to sound more native, polished, and natural. 
Crucially, you must try to naturally embed as many of the following target words into the rewritten text as possible: [${wordsList}].
If the user's text is too short, dynamically reduce the number of target words you try to embed to keep it natural. 
Output ONLY the rewritten text. Do not add any conversational filler. Ensure that the target words you embed appear exactly as provided so they can be matched later, though basic grammatical conjugation is acceptable if absolutely necessary (but exact match is strongly preferred).

User's Text:
${text}`
  const systemPrompt = 'You are a helpful expert editor.'

  return callOpenAI(prompt, systemPrompt, settings)
}

export async function aiGenerateReadyVersion(
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const prompt = `You are an expert linguist.
Target Phrase/Idiom: "${front}"

Explain the meaning, nuance, and usage of this idiom/phrase. Provide a translation and an example sentence.
Format the output clearly. Return ONLY the flashcard back side content.`
  return await callAiApi(prompt, settings)
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
