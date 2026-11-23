export type ClozeStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ClozeErrorKind = 'terminal' | 'systemic' | 'transient'

export interface ClozeCacheEntry {
  status: ClozeStatus
  text?: string
  error?: string
  errorKind?: ClozeErrorKind
  updatedAt: number
}

export interface PrefetchTarget {
  sessionKey: string
  cardId: number
  front: string
  back: string
  isSecondReview?: boolean
}

export interface PrefetchProgress {
  total: number
  ready: number
  failed: number
  retryableFailed: number
  terminalFailed: number
  loading: number
  paused: boolean
  pauseReason: string | null
  started: boolean
}

export type ClozeFetcher = (payload: {
  front: string
  back: string
}) => Promise<{ success: boolean; result?: string; error?: string }>

export interface ClozePrefetcherOptions {
  pacingDelayMs?: number
  maxConsecutiveFailures?: number
}

const TERMINAL_ERROR_RE = /0 sentences matched/i
const SYSTEMIC_ERROR_RE =
  /missing sketch engine api key|missing .*api key|http 401|http 402|http 403|\b401\b|\b402\b|\b403\b|unauthorized|invalid api key|insufficient|quota|balance|credit|billing|余额|额度/i

export function classifyClozeError(errorMessage: string): ClozeErrorKind {
  if (TERMINAL_ERROR_RE.test(errorMessage)) return 'terminal'
  if (SYSTEMIC_ERROR_RE.test(errorMessage)) return 'systemic'
  return 'transient'
}

function makeFirstPassKey(cardId: number, front: string, back: string): string {
  return `${cardId}::${front}::${back}`
}

/**
 * Single-concurrency background prefetcher for Useful Expressions cloze contexts,
 * with head-of-line priority for the active card, failure isolation, and circuit breaking.
 */
export class ClozePrefetcher {
  private readonly fetcher: ClozeFetcher
  private readonly pacingDelayMs: number
  private readonly maxConsecutiveFailures: number

  private entries = new Map<string, ClozeCacheEntry>()
  private firstPassCache = new Map<string, string>()
  private inFlight = new Map<string, Promise<void>>()
  private targetByKey = new Map<string, PrefetchTarget>()
  private orderedTargets: PrefetchTarget[] = []
  private activeSessionKey: string | null = null

  private started = false
  private backgroundRunning = false
  private paused = false
  private pauseReason: string | null = null
  private consecutiveFailures = 0
  private disposed = false
  private listeners = new Set<() => void>()

  constructor(fetcher: ClozeFetcher, options: ClozePrefetcherOptions = {}) {
    this.fetcher = fetcher
    this.pacingDelayMs = options.pacingDelayMs ?? 650
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    if (this.disposed) return
    for (const listener of this.listeners) {
      listener()
    }
  }

  getEntry(sessionKey: string): ClozeCacheEntry | undefined {
    return this.entries.get(sessionKey)
  }

  getProgress(): PrefetchProgress {
    let ready = 0
    let failed = 0
    let retryableFailed = 0
    let terminalFailed = 0
    let loading = 0
    for (const target of this.orderedTargets) {
      const entry = this.entries.get(target.sessionKey)
      if (!entry) continue
      if (entry.status === 'ready') ready += 1
      else if (entry.status === 'error') {
        failed += 1
        if (entry.errorKind === 'terminal') {
          terminalFailed += 1
        } else {
          retryableFailed += 1
        }
      } else if (entry.status === 'loading') loading += 1
    }
    return {
      total: this.orderedTargets.length,
      ready,
      failed,
      retryableFailed,
      terminalFailed,
      loading,
      paused: this.paused,
      pauseReason: this.pauseReason,
      started: this.started
    }
  }

  /**
   * Starts background prefetching (Strategy B: call when user enters Revision).
   */
  start(): void {
    if (this.disposed) return
    if (!this.started) {
      this.started = true
      this.notify()
    }
    this.ensureActiveLoaded()
    void this.pumpBackground()
  }

  /**
   * Synchronizes the remaining Useful Expressions queue and currently active sessionKey.
   */
  syncTargets(targets: PrefetchTarget[], activeSessionKey: string | null): void {
    if (this.disposed) return

    this.orderedTargets = targets
    this.activeSessionKey = activeSessionKey

    let cacheHydrated = false
    for (const target of targets) {
      this.targetByKey.set(target.sessionKey, target)

      // Reuse already-fetched first-pass cloze if the queue reloaded before review started.
      // Never reuse for Forgot (second-review) items so they receive a fresh sentence.
      if (!target.isSecondReview && !this.entries.has(target.sessionKey)) {
        const cachedText = this.firstPassCache.get(makeFirstPassKey(target.cardId, target.front, target.back))
        if (cachedText) {
          this.entries.set(target.sessionKey, {
            status: 'ready',
            text: cachedText,
            updatedAt: Date.now()
          })
          cacheHydrated = true
        }
      }
    }

    if (cacheHydrated) {
      this.notify()
    }

    if (this.started) {
      this.ensureActiveLoaded()
      void this.pumpBackground()
    }
  }

  /**
   * Fetches a single card immediately (used by single-card review mode without disturbing
   * the main session's prefetch queue).
   */
  fetchOnDemand(target: PrefetchTarget): void {
    if (this.disposed) return
    this.targetByKey.set(target.sessionKey, target)
    const existing = this.entries.get(target.sessionKey)
    if (existing && (existing.status === 'ready' || existing.status === 'loading')) {
      return
    }
    void this.runFetch(target, false)
  }

  /**
   * Explicitly retries a target (e.g. user clicked Retry button).
   * Succeeding clears any circuit-breaker pause and resumes background prefetching.
   */
  retry(target: PrefetchTarget): void {
    if (this.disposed) return
    this.targetByKey.set(target.sessionKey, target)
    if (this.inFlight.has(target.sessionKey)) return
    this.entries.delete(target.sessionKey)
    void this.runFetch(target, true)
  }

  /**
   * Resumes background prefetching after a circuit-breaker pause and retries
   * all non-terminal failed targets.
   */
  resume(): void {
    this.retryFailed()
  }

  /**
   * Re-queues all non-terminal (transient/systemic) failed targets for retry
   * without interrupting healthy cards, clearing any pause state if active.
   */
  retryFailed(): void {
    if (this.disposed) return
    this.paused = false
    this.pauseReason = null
    this.consecutiveFailures = 0

    for (const target of this.orderedTargets) {
      const entry = this.entries.get(target.sessionKey)
      if (entry && entry.status === 'error' && entry.errorKind !== 'terminal' && !this.inFlight.has(target.sessionKey)) {
        this.entries.delete(target.sessionKey)
      }
    }
    this.notify()

    if (this.started) {
      this.ensureActiveLoaded()
      void this.pumpBackground()
    }
  }

  /**
   * Invalidates cached cloze entries when a card's front/back text is edited inline.
   */
  invalidateCard(cardId: number): void {
    if (this.disposed) return
    const prefix = `${cardId}::`
    for (const key of Array.from(this.firstPassCache.keys())) {
      if (key.startsWith(prefix)) {
        this.firstPassCache.delete(key)
      }
    }
    for (const [sessionKey, target] of this.targetByKey.entries()) {
      if (target.cardId === cardId && !this.inFlight.has(sessionKey)) {
        this.entries.delete(sessionKey)
      }
    }
    this.notify()
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }

  private ensureActiveLoaded(): void {
    if (!this.activeSessionKey || this.paused || this.disposed) return
    const activeTarget = this.orderedTargets.find(t => t.sessionKey === this.activeSessionKey)
    if (!activeTarget) return
    const entry = this.entries.get(activeTarget.sessionKey)
    if (!entry && !this.inFlight.has(activeTarget.sessionKey)) {
      // Launch immediately so a slow background card never stalls the currently viewed card
      void this.runFetch(activeTarget, false)
    }
  }

  private pickNextBackgroundTarget(): PrefetchTarget | null {
    if (this.activeSessionKey) {
      const activeTarget = this.orderedTargets.find(t => t.sessionKey === this.activeSessionKey)
      if (activeTarget && !this.entries.has(activeTarget.sessionKey) && !this.inFlight.has(activeTarget.sessionKey)) {
        return activeTarget
      }
    }
    for (const target of this.orderedTargets) {
      if (!this.entries.has(target.sessionKey) && !this.inFlight.has(target.sessionKey)) {
        return target
      }
    }
    return null
  }

  private async pumpBackground(): Promise<void> {
    if (this.backgroundRunning || !this.started || this.paused || this.disposed) return
    this.backgroundRunning = true
    try {
      while (!this.disposed && this.started && !this.paused) {
        // Keep strict concurrency=1 during normal flow: wait for an active foreground fetch
        // before launching the next background card.
        const activeInFlight = this.activeSessionKey ? this.inFlight.get(this.activeSessionKey) : undefined
        if (activeInFlight) {
          await activeInFlight
          if (this.disposed || this.paused) break
          if (this.pacingDelayMs > 0 && this.pickNextBackgroundTarget()) {
            await new Promise(resolve => setTimeout(resolve, this.pacingDelayMs))
          }
          continue
        }

        const nextTarget = this.pickNextBackgroundTarget()
        if (!nextTarget) break
        await this.runFetch(nextTarget, false)
        if (this.disposed || this.paused) break
        if (this.pacingDelayMs > 0 && this.pickNextBackgroundTarget()) {
          await new Promise(resolve => setTimeout(resolve, this.pacingDelayMs))
        }
      }
    } finally {
      this.backgroundRunning = false
    }
  }

  private runFetch(target: PrefetchTarget, isManualRetry: boolean): Promise<void> {
    const existingPromise = this.inFlight.get(target.sessionKey)
    if (existingPromise) return existingPromise

    this.entries.set(target.sessionKey, {
      status: 'loading',
      updatedAt: Date.now()
    })
    this.notify()

    const task = (async () => {
      try {
        const res = await this.fetcher({ front: target.front, back: target.back })
        if (this.disposed) return

        if (res.success && res.result) {
          this.consecutiveFailures = 0
          this.entries.set(target.sessionKey, {
            status: 'ready',
            text: res.result,
            updatedAt: Date.now()
          })
          if (!target.isSecondReview) {
            this.firstPassCache.set(makeFirstPassKey(target.cardId, target.front, target.back), res.result)
          }
          if (isManualRetry && this.paused) {
            this.paused = false
            this.pauseReason = null
            if (this.started) {
              void this.pumpBackground()
            }
          }
        } else {
          this.handleFetchError(target, res.error || 'Failed to generate cloze context.')
        }
      } catch (err: any) {
        if (this.disposed) return
        this.handleFetchError(target, err?.message || 'Failed to generate cloze context.')
      } finally {
        this.inFlight.delete(target.sessionKey)
        this.notify()
      }
    })()

    this.inFlight.set(target.sessionKey, task)
    return task
  }

  private handleFetchError(target: PrefetchTarget, errorMsg: string): void {
    const errorKind = classifyClozeError(errorMsg)
    this.entries.set(target.sessionKey, {
      status: 'error',
      error: errorMsg,
      errorKind,
      updatedAt: Date.now()
    })

    if (errorKind === 'terminal') {
      // Service is healthy; this card's grammar simply yielded 0 corpus hits.
      this.consecutiveFailures = 0
      return
    }

    if (errorKind === 'systemic') {
      this.paused = true
      this.pauseReason = errorMsg
      return
    }

    this.consecutiveFailures += 1
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.paused = true
      this.pauseReason = errorMsg
    }
  }
}
