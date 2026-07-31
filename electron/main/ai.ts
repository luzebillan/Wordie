import { dbHandlers } from './db'

export async function generateUsefulExpression(expression: string, context: string, style: string) {
  const settings = dbHandlers.getSettings()
  const apiKey = settings.aiKey
  
  if (!apiKey) {
    throw new Error('AI API Key is not configured in Settings.')
  }

  const targetUrl = (settings.aiUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = settings.aiModel || 'gpt-4o'

  const prompt = `You are a helpful language learning assistant.
The user wants to learn the expression: "${expression}"
Context in which they found it: "${context || 'No specific context provided.'}"
Desired style/register for the explanation: "${style}"

Please generate a flashcard for this expression.
Output strictly in JSON format with the following structure:
{
  "definition": "A clear, concise definition of the expression in this context.",
  "example": "A natural example sentence using the expression."
}`

  try {
    const res = await fetch(`${targetUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText.slice(0, 100)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content returned from AI API.')
    }

    // Try to parse the JSON output
    try {
      const parsed = JSON.parse(content)
      return { success: true, data: parsed }
    } catch (e) {
      return { success: true, data: { definition: content, example: '' } }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
