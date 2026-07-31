export async function aiGenerateExpression(
  context: string,
  style: string,
  front: string,
  settings: Record<string, string>
): Promise<{ success: boolean; result?: string; error?: string }> {
  const apiKey = settings['aiKey']
  let apiUrl = settings['aiUrl'] || 'https://api.openai.com/v1'
  const model = settings['aiModel'] || 'gpt-4o'

  if (!apiKey) {
    return { success: false, error: 'AI API Key is not configured in Settings.' }
  }

  // Ensure apiUrl ends with /chat/completions if it's just the base URL
  if (!apiUrl.endsWith('/chat/completions')) {
    apiUrl = apiUrl.replace(/\/+$/, '') + '/chat/completions'
  }

  const prompt = `You are an expert language teacher.
Target Expression/Word: "${front}"
Context/Sentence it was found in: "${context}"
Desired Style/Register: ${style || 'General'}

Please generate a concise, accurate flashcard back side for this target expression.
Include:
1. A brief explanation of the meaning in this context.
2. The pronunciation or phonetic spelling (if applicable).
3. 1-2 natural example sentences.

Format the output clearly. Return ONLY the flashcard back side content.`

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
