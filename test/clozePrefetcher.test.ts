import { describe, it, expect, vi } from 'vitest'
import {
  ClozePrefetcher,
  classifyClozeError,
  type PrefetchTarget
} from '../src/utils/clozePrefetcher'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const makeTarget = (id: number, sessionKey: string, isSecondReview = false): PrefetchTarget => ({
  sessionKey,
  cardId: id,
  front: `phrase ${id}`,
  back: `meaning ${id}`,
  isSecondReview
})

async function flushMicrotasks(ticks = 6) {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve()
  }
}

describe('ClozePrefetcher', () => {
  it('classifies terminal, systemic, and transient errors accurately', () => {
    expect(classifyClozeError('Sketch Engine search succeeded, but 0 sentences matched this grammar.')).toBe('terminal')
    expect(classifyClozeError('Missing Sketch Engine API Key in Settings.')).toBe('systemic')
    expect(classifyClozeError('Sketch Engine API error (HTTP 401).')).toBe('systemic')
    expect(classifyClozeError('AI failed to rewrite context: insufficient quota')).toBe('systemic')
    expect(classifyClozeError('Sketch Engine API timeout or network error: TimeoutError')).toBe('transient')
    expect(classifyClozeError('Sketch Engine API rate limited (HTTP 429).')).toBe('transient')
  })

  it('Strategy B: does not fetch until start() is called, then prefetches sequentially with concurrency=1', async () => {
    const deferreds = [createDeferred<any>(), createDeferred<any>(), createDeferred<any>()]
    let callIdx = 0
    const fetcher = vi.fn(() => deferreds[callIdx++].promise)

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    const targets = [makeTarget(1, 'k1'), makeTarget(2, 'k2'), makeTarget(3, 'k3')]

    prefetcher.syncTargets(targets, 'k1')
    await flushMicrotasks()
    expect(fetcher).toHaveBeenCalledTimes(0)
    expect(prefetcher.getProgress().started).toBe(false)

    // Enter Revision tab -> start()
    prefetcher.start()
    await flushMicrotasks()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenLastCalledWith({ front: 'phrase 1', back: 'meaning 1' })
    expect(prefetcher.getEntry('k1')?.status).toBe('loading')
    expect(prefetcher.getEntry('k2')).toBeUndefined()

    // Complete card 1 -> card 2 starts automatically in background
    deferreds[0].resolve({ success: true, result: 'cloze 1' })
    await flushMicrotasks()
    expect(prefetcher.getEntry('k1')).toMatchObject({ status: 'ready', text: 'cloze 1' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenLastCalledWith({ front: 'phrase 2', back: 'meaning 2' })

    // Complete card 2 -> card 3 starts
    deferreds[1].resolve({ success: true, result: 'cloze 2' })
    await flushMicrotasks()
    expect(fetcher).toHaveBeenCalledTimes(3)

    // Complete card 3 -> all ready
    deferreds[2].resolve({ success: true, result: 'cloze 3' })
    await flushMicrotasks()
    expect(prefetcher.getProgress()).toMatchObject({
      total: 3,
      ready: 3,
      failed: 0,
      loading: 0,
      paused: false
    })
  })

  it('prioritizes an uncached card immediately on Shuffle without blocking behind a slow background card', async () => {
    const slowBg = createDeferred<any>()
    const urgentCard = createDeferred<any>()
    const calls: string[] = []

    const fetcher = vi.fn((payload: { front: string; back: string }) => {
      calls.push(payload.front)
      if (payload.front === 'phrase 1') return Promise.resolve({ success: true, result: 'cloze 1' })
      if (payload.front === 'phrase 2') return slowBg.promise
      if (payload.front === 'phrase 3') return urgentCard.promise
      return Promise.resolve({ success: true, result: 'other' })
    })

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    const targets = [makeTarget(1, 'k1'), makeTarget(2, 'k2'), makeTarget(3, 'k3')]
    prefetcher.syncTargets(targets, 'k1')
    prefetcher.start()
    await flushMicrotasks()

    // Card 1 ready, Card 2 now slow in background
    expect(prefetcher.getEntry('k1')?.status).toBe('ready')
    expect(prefetcher.getEntry('k2')?.status).toBe('loading')

    // User shuffles and lands on Card 3 while Card 2 is still in-flight
    prefetcher.syncTargets([makeTarget(3, 'k3'), makeTarget(2, 'k2')], 'k3')
    await flushMicrotasks()

    // Card 3 must start immediately instead of waiting for slow Card 2
    expect(calls).toEqual(['phrase 1', 'phrase 2', 'phrase 3'])
    expect(prefetcher.getEntry('k3')?.status).toBe('loading')

    urgentCard.resolve({ success: true, result: 'cloze 3' })
    slowBg.resolve({ success: true, result: 'cloze 2' })
    await flushMicrotasks()

    expect(prefetcher.getEntry('k3')).toMatchObject({ status: 'ready', text: 'cloze 3' })
    expect(prefetcher.getEntry('k2')).toMatchObject({ status: 'ready', text: 'cloze 2' })
  })

  it('generates a fresh cloze for Forgot (isSecondReview) while reusing first-pass cache on pre-start reload', async () => {
    let seq = 0
    const fetcher = vi.fn(async (payload: { front: string }) => {
      seq += 1
      return { success: true, result: `${payload.front} v${seq}` }
    })

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    prefetcher.syncTargets([makeTarget(1, 'k1-initial')], 'k1-initial')
    prefetcher.start()
    await flushMicrotasks()

    expect(prefetcher.getEntry('k1-initial')?.text).toBe('phrase 1 v1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Pre-start queue reload assigns new sessionKey with isSecondReview = false -> reuses cache!
    prefetcher.syncTargets([makeTarget(1, 'k1-reloaded', false)], 'k1-reloaded')
    await flushMicrotasks()
    expect(prefetcher.getEntry('k1-reloaded')?.text).toBe('phrase 1 v1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Forgot re-queues card 1 with isSecondReview = true -> generates fresh cloze!
    prefetcher.syncTargets([makeTarget(1, 'k1-second', true)], 'k1-second')
    await flushMicrotasks()
    expect(prefetcher.getEntry('k1-second')?.text).toBe('phrase 1 v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('skips terminal (0 sentences) and transient errors without stalling subsequent cards', async () => {
    const fetcher = vi.fn(async (payload: { front: string }) => {
      if (payload.front === 'phrase 1') {
        return { success: false, error: 'Sketch Engine search succeeded, but 0 sentences matched this grammar.' }
      }
      if (payload.front === 'phrase 2') {
        return { success: false, error: 'Sketch Engine API timeout or network error: TimeoutError' }
      }
      return { success: true, result: `cloze for ${payload.front}` }
    })

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    prefetcher.syncTargets([makeTarget(1, 'k1'), makeTarget(2, 'k2'), makeTarget(3, 'k3')], 'k1')
    prefetcher.start()
    await flushMicrotasks(12)

    expect(prefetcher.getEntry('k1')).toMatchObject({ status: 'error', errorKind: 'terminal' })
    expect(prefetcher.getEntry('k2')).toMatchObject({ status: 'error', errorKind: 'transient' })
    expect(prefetcher.getEntry('k3')).toMatchObject({ status: 'ready', text: 'cloze for phrase 3' })
    expect(prefetcher.getProgress()).toMatchObject({
      total: 3,
      ready: 1,
      failed: 2,
      paused: false
    })
  })

  it('pauses background prefetch immediately on systemic quota/auth errors and resumes after manual retry succeeds', async () => {
    let failSystemic = true
    const fetcher = vi.fn(async (payload: { front: string }) => {
      if (failSystemic) {
        return { success: false, error: 'AI failed to rewrite context: insufficient quota (402)' }
      }
      return { success: true, result: `ok ${payload.front}` }
    })

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    const targets = [makeTarget(1, 'k1'), makeTarget(2, 'k2'), makeTarget(3, 'k3')]
    prefetcher.syncTargets(targets, 'k1')
    prefetcher.start()
    await flushMicrotasks(10)

    // Stopped after first systemic error; did NOT spam card 2 or card 3
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(prefetcher.getProgress().paused).toBe(true)
    expect(prefetcher.getEntry('k2')).toBeUndefined()

    // User tops up API and clicks Retry on card 1 -> succeeds and resumes prefetching card 2 & 3
    failSystemic = false
    prefetcher.retry(targets[0])
    await flushMicrotasks(15)

    expect(prefetcher.getProgress()).toMatchObject({
      total: 3,
      ready: 3,
      failed: 0,
      paused: false
    })
  })

  it('trips circuit breaker after 3 consecutive transient failures and supports resume()', async () => {
    let shouldFail = true
    const fetcher = vi.fn(async (payload: { front: string }) => {
      if (shouldFail) {
        return { success: false, error: 'Sketch Engine API timeout or network error: TimeoutError' }
      }
      return { success: true, result: `recovered ${payload.front}` }
    })

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0, maxConsecutiveFailures: 3 })
    const targets = [makeTarget(1, 'k1'), makeTarget(2, 'k2'), makeTarget(3, 'k3'), makeTarget(4, 'k4')]
    prefetcher.syncTargets(targets, 'k1')
    prefetcher.start()
    await flushMicrotasks(15)

    // Failed on 1, 2, 3 -> paused before trying 4
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(prefetcher.getProgress().paused).toBe(true)
    expect(prefetcher.getEntry('k4')).toBeUndefined()

    // Network recovers -> user clicks Resume
    shouldFail = false
    prefetcher.resume()
    await flushMicrotasks(20)

    expect(prefetcher.getProgress()).toMatchObject({
      total: 4,
      ready: 4,
      failed: 0,
      paused: false
    })
  })

  it('invalidateCard clears cached entries for that cardId', async () => {
    const fetcher = vi.fn(async (payload: { front: string }) => ({
      success: true,
      result: `cloze ${payload.front}`
    }))

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    prefetcher.syncTargets([makeTarget(1, 'k1'), makeTarget(2, 'k2')], 'k1')
    prefetcher.start()
    await flushMicrotasks(10)

    expect(prefetcher.getEntry('k1')?.status).toBe('ready')
    expect(prefetcher.getEntry('k2')?.status).toBe('ready')

    prefetcher.invalidateCard(1)
    expect(prefetcher.getEntry('k1')).toBeUndefined()
    expect(prefetcher.getEntry('k2')?.status).toBe('ready')
  })

  it('keeps running through healthy cards during intermittent transient failures and retries failed ones on retryFailed()', async () => {
    // Pattern: F, S, F, S, F, S, F, S, F, S, S -> 5 intermittent failures, never 3 consecutive
    let shouldFailOdd = true
    const fetcher = vi.fn(async (payload: { front: string }) => {
      const id = Number(payload.front.replace('phrase ', ''))
      if (shouldFailOdd && id % 2 === 1 && id <= 9) {
        return { success: false, error: 'Sketch Engine API timeout or network error: TimeoutError' }
      }
      return { success: true, result: `ok ${payload.front}` }
    })

    const targets = Array.from({ length: 11 }, (_, idx) => makeTarget(idx + 1, `k${idx + 1}`))
    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    prefetcher.syncTargets(targets, 'k1')
    prefetcher.start()
    await flushMicrotasks(50)

    // Does NOT stall healthy cards 10 & 11 just because 5 intermittent failures occurred
    expect(prefetcher.getProgress()).toMatchObject({
      total: 11,
      ready: 6,
      failed: 5,
      retryableFailed: 5,
      terminalFailed: 0,
      paused: false
    })

    // User clicks "Retry failed" -> retries only the 5 failed cards without re-fetching ready ones
    shouldFailOdd = false
    prefetcher.retryFailed()
    await flushMicrotasks(50)

    expect(prefetcher.getProgress()).toMatchObject({
      total: 11,
      ready: 11,
      failed: 0,
      retryableFailed: 0,
      terminalFailed: 0,
      paused: false
    })
    expect(fetcher).toHaveBeenCalledTimes(16) // 11 initial + 5 retried
  })

  it('tracks retryableFailed and terminalFailed separately and skips terminal cards on retryFailed()', async () => {
    let failTransient = true
    const fetcher = vi.fn(async (payload: { front: string }) => {
      if (payload.front === 'phrase 1') {
        return { success: false, error: 'Sketch Engine search succeeded, but 0 sentences matched this grammar.' }
      }
      if (payload.front === 'phrase 2' && failTransient) {
        return { success: false, error: 'Sketch Engine API timeout or network error: TimeoutError' }
      }
      return { success: true, result: `ok ${payload.front}` }
    })

    const prefetcher = new ClozePrefetcher(fetcher, { pacingDelayMs: 0 })
    prefetcher.syncTargets([makeTarget(1, 'k1'), makeTarget(2, 'k2'), makeTarget(3, 'k3')], 'k1')
    prefetcher.start()
    await flushMicrotasks(15)

    expect(prefetcher.getProgress()).toMatchObject({
      total: 3,
      ready: 1,
      failed: 2,
      retryableFailed: 1,
      terminalFailed: 1,
      paused: false
    })

    failTransient = false
    prefetcher.retryFailed()
    await flushMicrotasks(15)

    expect(prefetcher.getProgress()).toMatchObject({
      total: 3,
      ready: 2,
      failed: 1,
      retryableFailed: 0,
      terminalFailed: 1,
      paused: false
    })
    expect(fetcher).toHaveBeenCalledTimes(4) // 3 initial + 1 transient retry (terminal not retried)
  })
})
