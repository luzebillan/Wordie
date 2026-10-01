/**
 * Formats and extracts a clean, user-friendly error message from various error types,
 * specifically handling Electron IPC wrappers and OpenAI / LLM API error responses.
 */
export function extractCleanErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred'
  
  const raw = typeof error === 'string' ? error : (error.message || String(error))
  
  // Strip Electron IPC boilerplate: e.g. "Error invoking remote method 'find-similar-cards': Error: ..."
  let cleaned = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '').trim()

  // Extract HTTP status code if present: e.g. "API Error (400): ..."
  const statusMatch = cleaned.match(/API Error \((\d+)\)/)
  const statusCode = statusMatch ? ` (${statusMatch[1]})` : ''

  // Extract JSON error payload message if present: e.g. {"error":{"message":"token quota is not enough",...}}
  const jsonMessageMatch = cleaned.match(/"message"\s*:\s*"([^"]+)"/)
  if (jsonMessageMatch && jsonMessageMatch[1]) {
    return `AI Error${statusCode}: ${jsonMessageMatch[1]}`
  }

  // Remove generic wrapper prefix if present
  if (cleaned.startsWith('AI failed to filter synonyms: ')) {
    cleaned = cleaned.replace('AI failed to filter synonyms: ', '').trim()
  }

  return cleaned || 'Unknown error occurred'
}
