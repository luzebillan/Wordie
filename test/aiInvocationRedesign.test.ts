import { describe, it, expect, vi } from 'vitest'
import {
  callAiApi,
  aiGenerateGlossary,
  aiGenerateDailyWord,
  aiGenerateExpression,
  aiRewritePractice,
  practicePureListener,
  practiceRewrite,
  practiceAiVersion,
  aiFilterSynonyms,
  generateRevisionCloze
} from '../electron/main/ai'

describe('AI Invocation Architecture & Structured Generation Redesign', () => {
  const dummySettings = {
    aiKey: 'test-api-key',
    aiUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-4o'
  }

  // Pillar 1: Temperature control & Pillar 3: Role separation
  it('callAiApi respects per-call temperature and separates system/user roles', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"status": "ok"}' } }]
        })
      }
    }) as any

    try {
      const res = await callAiApi(
        {
          system: 'You are an encyclopedia system.',
          user: 'Define Kash Patel',
          temperature: 0.1
        },
        dummySettings
      )

      expect(res.success).toBe(true)
      expect(capturedBody).not.toBeNull()
      expect(capturedBody.temperature).toBe(0.1)
      expect(capturedBody.messages).toHaveLength(2)
      expect(capturedBody.messages[0]).toEqual({
        role: 'system',
        content: 'You are an encyclopedia system.'
      })
      expect(capturedBody.messages[1]).toEqual({
        role: 'user',
        content: 'Define Kash Patel'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // Pillar 2: Structured Output / JSON Mode with safe fallback retry
  it('callAiApi automatically injects response_format: { type: "json_object" }', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }]
        })
      }
    }) as any

    try {
      const res = await callAiApi(
        {
          system: 'You must respond in JSON format.',
          user: 'Give me JSON',
          temperature: 0.1,
          responseFormat: { type: 'json_object' }
        },
        dummySettings
      )

      expect(res.success).toBe(true)
      expect(capturedBody.response_format).toEqual({ type: 'json_object' })
      expect(capturedBody.temperature).toBe(0.1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('callAiApi gracefully retries without response_format when proxy returns 400 Bad Request', async () => {
    const originalFetch = globalThis.fetch
    const calls: any[] = []

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      calls.push(body)

      if (calls.length === 1) {
        // First call with response_format -> proxy rejects with 400 Bad Request
        return {
          ok: false,
          status: 400,
          text: async () => 'Unrecognized request argument supplied: response_format'
        }
      }

      // Second call (fallback without response_format) -> succeeds!
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{\n  "term_cn": "卡什·帕特尔",\n  "term_en": "Kash Patel",\n  "def_cn": "前官员",\n  "def_en": "Former official"\n}'
            }
          }]
        })
      }
    }) as any

    try {
      const res = await callAiApi(
        {
          system: 'You are an encyclopedia system. Output JSON format.',
          user: 'Define Kash Patel',
          temperature: 0.1,
          responseFormat: { type: 'json_object' }
        },
        dummySettings
      )

      expect(res.success).toBe(true)
      expect(calls).toHaveLength(2)
      // Call 1 had response_format
      expect(calls[0].response_format).toEqual({ type: 'json_object' })
      // Call 2 fallback stripped response_format
      expect(calls[1].response_format).toBeUndefined()
      expect(calls[1].temperature).toBe(0.1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('callAiApi handles 400 without response_format directly as error without looping', async () => {
    const originalFetch = globalThis.fetch
    let callCount = 0

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++
      return {
        ok: false,
        status: 400,
        text: async () => 'Invalid model name'
      }
    }) as any

    try {
      const res = await callAiApi(
        {
          prompt: 'Hello'
        },
        dummySettings
      )

      expect(res.success).toBe(false)
      expect(res.error).toContain('API Error (400): Invalid model name')
      expect(callCount).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('aiGenerateGlossary invokes callAiApi with temperature 0.1, json_object mode, and separated roles', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                term_cn: '卡什·帕特尔',
                term_en: 'Kash Patel',
                def_cn: '美国律师及前官员。',
                def_en: 'An American attorney and former official.'
              })
            }
          }]
        })
      }
    }) as any

    try {
      const res = await aiGenerateGlossary(['Politics', 'Defense'], 'Kash Patel', dummySettings)
      expect(res.success).toBe(true)
      expect(capturedBody).not.toBeNull()
      expect(capturedBody.temperature).toBe(0.1)
      expect(capturedBody.response_format).toEqual({ type: 'json_object' })
      expect(capturedBody.messages).toHaveLength(2)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[0].content).toContain('You are an expert encyclopedia')
      expect(capturedBody.messages[1].role).toBe('user')
      expect(capturedBody.messages[1].content).toContain('Kash Patel')
      expect(capturedBody.messages[1].content).toContain('Politics, Defense')

      const parsed = JSON.parse(res.result!)
      expect(parsed.front).toBe('卡什·帕特尔\nKash Patel')
      expect(parsed.back).toBe('美国律师及前官员。\nAn American attorney and former official.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('aiGenerateDailyWord uses callAiApi with temperature 0.2 and multimodal user content', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'nuke'
            }
          }]
        })
      }
    }) as any

    try {
      const res = await aiGenerateDailyWord(
        {
          front: '叮一下',
          context: '去微波炉叮一个便当'
        },
        dummySettings
      )

      expect(res.success).toBe(true)
      expect(res.result).toBe('nuke')
      expect(capturedBody.temperature).toBe(0.2)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[1].role).toBe('user')
      expect(capturedBody.messages[1].content[0].text).toContain('叮一下')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('aiGenerateExpression uses callAiApi with temperature 0.2 and role separation', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'To force rapid passage of legislation.'
            }
          }]
        })
      }
    }) as any

    try {
      const res = await aiGenerateExpression('Congress will ram through the bill.', 'concise', 'ram through', dummySettings)
      expect(res.success).toBe(true)
      expect(res.result).toBe('To force rapid passage of legislation.')
      expect(capturedBody.temperature).toBe(0.2)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[1].role).toBe('user')
      expect(capturedBody.messages[1].content).toContain('ram through')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('practiceAiVersion uses callAiApi with creative temperature 0.7', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Elite interpretation of the text.'
            }
          }]
        })
      }
    }) as any

    try {
      const res = await practiceAiVersion('Input speech transcript.', dummySettings)
      expect(res.success).toBe(true)
      expect(res.result).toBe('Elite interpretation of the text.')
      expect(capturedBody.temperature).toBe(0.7)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[1].role).toBe('user')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('aiFilterSynonyms uses callAiApi with temperature 0.1 and role separation', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '["10", "20"]'
            }
          }]
        })
      }
    }) as any

    try {
      const candidates = [
        { id: 10, front: 'call the shots', back: 'make decisions' },
        { id: 20, front: 'in charge', back: 'having control' }
      ]
      const res = await aiFilterSynonyms('be in the driver seat', 'be in control', candidates, dummySettings, 'He was in the driver seat.')
      expect(res.success).toBe(true)
      expect(res.result).toEqual(['10', '20'])
      expect(capturedBody.temperature).toBe(0.1)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[1].role).toBe('user')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('practicePureListener uses callAiApi with temperature 0.5 and role separation', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Clear logic, coherent argument.'
            }
          }]
        })
      }
    }) as any

    try {
      const res = await practicePureListener('I believe education is essential.', dummySettings)
      expect(res.success).toBe(true)
      expect(res.result).toBe('Clear logic, coherent argument.')
      expect(capturedBody.temperature).toBe(0.5)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[0].content).toContain('Pure Listener')
      expect(capturedBody.messages[1].role).toBe('user')
      expect(capturedBody.messages[1].content).toContain('I believe education is essential.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('aiRewritePractice uses callAiApi with temperature 0.7 and role separation', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'We need to call the shots here.'
            }
          }]
        })
      }
    }) as any

    try {
      const res = await aiRewritePractice('We should make decisions.', ['call the shots'], dummySettings)
      expect(res.success).toBe(true)
      expect(res.result).toBe('We need to call the shots here.')
      expect(capturedBody.temperature).toBe(0.7)
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[0].content).toContain('<database>')
      expect(capturedBody.messages[0].content).toContain('call the shots')
      expect(capturedBody.messages[1].role).toBe('user')
      expect(capturedBody.messages[1].content).toBe('Text:\nWe should make decisions.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('practiceRewrite uses callAiApi with temperature 0.2 and json_object response format', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewritten_text: 'The car screeched to a halt.',
                used_card_ids: [1]
              })
            }
          }]
        })
      }
    }) as any

    try {
      const mockDb = {
        getCards: vi.fn().mockReturnValue([{ id: 1, front: 'screeched to a halt', back: 'stopped suddenly' }]),
        getDueCards: vi.fn().mockReturnValue([])
      }
      const res = await practiceRewrite('The car stopped suddenly.', dummySettings, mockDb)
      expect(res.success).toBe(true)
      expect(res.result.text).toBe('The car screeched to a halt.')
      expect(capturedBody.temperature).toBe(0.2)
      expect(capturedBody.response_format).toEqual({ type: 'json_object' })
      expect(capturedBody.messages[0].role).toBe('system')
      expect(capturedBody.messages[0].content).toContain('<vocabulary_bank>')
      expect(capturedBody.messages[1].role).toBe('user')
      expect(capturedBody.messages[1].content).toContain('The car stopped suddenly.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('respects user custom prompt in settings for glossary generation', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                term_cn: '无党派',
                term_en: 'Non-partisan',
                def_cn: '中立立场',
                def_en: 'Neutral stance'
              })
            }
          }]
        })
      }
    }) as any

    try {
      const customSettings = {
        ...dummySettings,
        promptGlossary: 'Custom prompt for {{term}} in {{labels}}. Output JSON:'
      }
      const res = await aiGenerateGlossary(['Politics'], 'Non-partisan', customSettings)
      expect(res.success).toBe(true)
      expect(capturedBody.messages[0].content).toContain('Custom prompt for Non-partisan in Politics. Output JSON:')
      expect(capturedBody.messages[1].content).toContain('Target term: "Non-partisan"')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('handles fallback failure when proxy returns 400 and subsequent fallback returns error', async () => {
    const originalFetch = globalThis.fetch
    let calls = 0

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      calls++
      if (calls === 1) {
        return {
          ok: false,
          status: 400,
          text: async () => 'response_format is unsupported'
        }
      }
      return {
        ok: false,
        status: 401,
        text: async () => 'Invalid API key on fallback'
      }
    }) as any

    try {
      const res = await callAiApi(
        {
          prompt: 'Hello in JSON',
          responseFormat: { type: 'json_object' }
        },
        dummySettings
      )

      expect(res.success).toBe(false)
      expect(res.error).toContain('API Error (401): Invalid API key on fallback')
      expect(calls).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns error when API key is missing', async () => {
    const res = await callAiApi('test prompt', {})
    expect(res.success).toBe(false)
    expect(res.error).toBe('AI API Key is not configured in Settings.')
  })

  it('generateRevisionCloze uses temperature 0.3, role separation and template replacement', async () => {
    const originalFetch = globalThis.fetch
    let capturedAiBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
      if (url.includes('sketchengine')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            Lines: [
              {
                Left: [{ str: 'The committee decided to ' }],
                Kwic: [{ str: 'call the shots' }],
                Right: [{ str: ' on upcoming fiscal policy.' }]
              }
            ]
          })
        }
      }

      capturedAiBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'The committee decided to ________ on upcoming fiscal policy.'
            }
          }]
        })
      }
    }) as any

    try {
      const clozeSettings = {
        ...dummySettings,
        sketchEngineKey: 'test-sketch-key',
        sketchEngineUrl: 'https://api.sketchengine.eu/bonito/run.cgi'
      }

      const res = await generateRevisionCloze('call the shots', 'make decisions', clozeSettings)
      expect(res.success).toBe(true)
      expect(res.result).toBe('The committee decided to ________ on upcoming fiscal policy.')
      expect(capturedAiBody).not.toBeNull()
      expect(capturedAiBody.temperature).toBe(0.3)
      expect(capturedAiBody.messages).toHaveLength(2)
      expect(capturedAiBody.messages[0].role).toBe('system')
      expect(capturedAiBody.messages[0].content).toContain('You are an educational AI assistant')
      expect(capturedAiBody.messages[1].role).toBe('user')
      expect(capturedAiBody.messages[1].content).toContain('<target_phrase>call the shots</target_phrase>')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('callAiApi handles HTTP 422 fallback retry without response_format', async () => {
    const originalFetch = globalThis.fetch
    const calls: any[] = []

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      const body = JSON.parse(opts.body)
      calls.push(body)

      if (calls.length === 1) {
        // First call with response_format -> proxy rejects with 422 Unprocessable Entity
        return {
          ok: false,
          status: 422,
          text: async () => 'Field response_format not allowed by model gateway'
        }
      }

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"ok": true}' } }]
        })
      }
    }) as any

    try {
      const res = await callAiApi(
        {
          prompt: 'Generate valid JSON object',
          responseFormat: { type: 'json_object' }
        },
        dummySettings
      )

      expect(res.success).toBe(true)
      expect(calls).toHaveLength(2)
      expect(calls[0].response_format).toEqual({ type: 'json_object' })
      expect(calls[1].response_format).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('callAiApi normalizes apiUrl with trailing slash and /chat/completions/ without duplication', async () => {
    const originalFetch = globalThis.fetch
    let requestedUrl = ''

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }]
        })
      }
    }) as any

    try {
      const settingsWithTrailingSlash = {
        aiKey: 'test-key',
        aiUrl: 'https://custom-proxy.example.com/v1/chat/completions/'
      }

      const res = await callAiApi('Hello', settingsWithTrailingSlash)
      expect(res.success).toBe(true)
      expect(requestedUrl).toBe('https://custom-proxy.example.com/v1/chat/completions')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('callAiApi does not mutate caller messages array or message objects', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"status": "ok"}' } }]
      })
    })) as any

    try {
      const originalMessages = [
        { role: 'system' as const, content: 'You are an assistant.' },
        { role: 'user' as const, content: 'Give me structured output' }
      ]

      const res = await callAiApi(
        {
          messages: originalMessages,
          responseFormat: { type: 'json_object' }
        },
        dummySettings
      )

      expect(res.success).toBe(true)
      // originalMessages[0].content must NOT be mutated in-place
      expect(originalMessages[0].content).toBe('You are an assistant.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('callAiApi extracts error message when endpoint returns 200 with an error object', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        error: { message: 'Quota exceeded on custom reverse proxy' }
      })
    })) as any

    try {
      const res = await callAiApi('Hello', dummySettings)
      expect(res.success).toBe(false)
      expect(res.error).toBe('Quota exceeded on custom reverse proxy')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('aiGenerateExpression replaces all occurrences when multiple placeholders exist in custom template', async () => {
    const originalFetch = globalThis.fetch
    let capturedBody: any = null

    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'concise definition' } }]
        })
      }
    }) as any

    try {
      const customSettings = {
        ...dummySettings,
        promptExpression: 'Analyze {{front}} in primary {{context}} and also verify {{context}} for {{front}}.'
      }

      const res = await aiGenerateExpression('He decided to call the shots in finance.', 'concise', 'call the shots', customSettings)
      expect(res.success).toBe(true)
      expect(capturedBody.messages[0].content).toBe(
        'Analyze call the shots in primary He decided to call the shots in finance. and also verify He decided to call the shots in finance. for call the shots.'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
