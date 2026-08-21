import { useState, useEffect, useRef, useCallback } from 'react'

export type SimilarityMode = 'search' | 'semantic'

interface UseSimilarCardsOptions {
  cardType: string
  debounceMs?: number
}

export function useSimilarCards({ cardType, debounceMs = 300 }: UseSimilarCardsOptions) {
  const [mode, setMode] = useState<SimilarityMode>('search')
  const [similarCards, setSimilarCards] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [query, setQuery] = useState('')

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryRef = useRef(query)
  queryRef.current = query

  // Debounced search on input change (Stage 1: Local Search)
  const setSearchQuery = useCallback((text: string) => {
    setQuery(text)
    setMode('search')
    
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }

    const trimmed = text.trim()
    if (!trimmed) {
      setSimilarCards([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await window.ipcRenderer.searchCards(trimmed, cardType)
        // Ensure we only update if query hasn't changed in the meantime
        if (queryRef.current.trim() === trimmed) {
          setSimilarCards(results || [])
        }
      } catch (err) {
        console.error('Failed to search cards locally:', err)
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)
  }, [cardType, debounceMs])

  // Trigger semantic analysis after Back Side generation (Stage 2: Transformer + LLM)
  const triggerSemanticSearch = useCallback(async (front: string, back: string, type?: string, context?: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    
    setMode('semantic')
    setIsAnalyzing(true)
    try {
      const results = await window.ipcRenderer.findSimilarCards(
        front.trim(),
        back.trim(),
        type || cardType,
        true,
        context?.trim() || ''
      )
      setSimilarCards(results || [])
    } catch (err) {
      console.error('Failed to find semantic similar cards:', err)
      setSimilarCards([])
    } finally {
      setIsAnalyzing(false)
    }
  }, [cardType])

  // Handle +1 manual review count
  const handleIncrementReviewCount = useCallback(async (id: number) => {
    try {
      await window.ipcRenderer.incrementManualReviewCount(id)
      setSimilarCards(prev =>
        prev.map(c =>
          c.id === id ? { ...c, manualReviewCount: (c.manualReviewCount || 0) + 1 } : c
        )
      )
      window.dispatchEvent(new Event('stats-updated'))
      
      setToastMessage('+1 Added successfully!')
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToastMessage(''), 3000)
    } catch (err) {
      console.error('Failed to increment review count:', err)
    }
  }, [])

  // Reset all states
  const reset = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setMode('search')
    setQuery('')
    setSimilarCards([])
    setIsSearching(false)
    setIsAnalyzing(false)
    setToastMessage('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  return {
    mode,
    similarCards,
    isSearching,
    isAnalyzing,
    toastMessage,
    query,
    setSearchQuery,
    triggerSemanticSearch,
    handleIncrementReviewCount,
    reset,
    setSimilarCards
  }
}
