import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Save, Shuffle, RotateCcw } from 'lucide-react'
import {
  type SessionCardItem,
  type CardReviewStatus,
  type ReviewAction,
  initSessionQueue,
  computeSessionStats,
  applyReviewToQueue,
  applyUndoToQueue,
  applySkipToQueue,
  applyShuffleToQueue,
  syncCardTextInQueue,
  createSessionItem
} from '../utils/revisionSession'
import { useShortcuts } from '../hooks/useShortcuts'

interface RevisionProps {
  specificCardId?: number
  isActive?: boolean
}

// Lightweight synthesized chime using Web Audio API singleton (Zero external assets needed)
let audioCtx: AudioContext | null = null
const playClozeReadySound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    if (!audioCtx) {
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    const ctx = audioCtx
    const now = ctx.currentTime

    // Harmonious chime (E5: 659.25Hz -> B5: 987.77Hz)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(659.25, now)
    osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.06)

    // Gentle fade in / fade out to avoid clicks
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.22)
  } catch (e) {
    // Graceful fallback
  }
}

export const Revision: React.FC<RevisionProps> = ({ specificCardId, isActive = true }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()

  // Session Queue State (fixed for this app run)
  const [sessionQueue, setSessionQueue] = useState<SessionCardItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardStatusMap, setCardStatusMap] = useState<Map<number, CardReviewStatus>>(new Map())
  const [undoStack, setUndoStack] = useState<ReviewAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const sessionInitializedRef = useRef(false)
  const clozeReqIdRef = useRef(0)

  // Single card mode state (when viewing/reviewing a specific card from library/search)
  const [singleCard, setSingleCard] = useState<SessionCardItem | null>(null)
  const [singleCardFinished, setSingleCardFinished] = useState(false)

  const [showAnswer, setShowAnswer] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(false)

  // Inline editing state
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  const [clozeContext, setClozeContext] = useState<string>('')
  const [clozeLoading, setClozeLoading] = useState(false)
  const [clozeError, setClozeError] = useState<string | null>(null)

  // Reverse State for Glossary and Ready Versions
  const [isReversed, setIsReversed] = useState<boolean>(false)
  const [isShuffling, setIsShuffling] = useState(false)

  // Timer & Threshold State
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [liveElapsedMs, setLiveElapsedMs] = useState<number>(0)
  const [easyThreshold, setEasyThreshold] = useState<number>(2)
  const [goodThreshold, setGoodThreshold] = useState<number>(30)

  useEffect(() => {
    window.ipcRenderer.getSettings().then(settings => {
      if (settings.easyThreshold) setEasyThreshold(parseFloat(settings.easyThreshold))
      if (settings.goodThreshold) setGoodThreshold(parseFloat(settings.goodThreshold))
    })
  }, [])

  // 1. Initialize session queue ONCE upon app launch/mount
  useEffect(() => {
    if (sessionInitializedRef.current) return
    sessionInitializedRef.current = true

    const initSession = async () => {
      setIsLoading(true)
      try {
        const cards = await window.ipcRenderer.getDueCards()
        const { queue, statusMap } = initSessionQueue(cards || [])
        setSessionQueue(queue)
        setCurrentIndex(0)
        setCardStatusMap(statusMap)
        setUndoStack([])
      } catch (e) {
        console.error('Failed to initialize revision session:', e)
      } finally {
        setIsLoading(false)
      }
    }

    initSession()
  }, [])

  // 2. Handle specific card single-review mode
  useEffect(() => {
    if (specificCardId) {
      setIsLoading(true)
      setSingleCardFinished(false)
      window.ipcRenderer.getCard(specificCardId).then(card => {
        setSingleCard(card ? createSessionItem(card) : null)
        setIsLoading(false)
      }).catch(err => {
        console.error(err)
        setIsLoading(false)
      })
    } else {
      setSingleCard(null)
      setSingleCardFinished(false)
    }
  }, [specificCardId])

  // 3. Handle card deleted event
  useEffect(() => {
    const handleCardDeleted = (e: any) => {
      const deletedId = e.detail
      setSessionQueue(prev => prev.filter(c => c.id !== deletedId))
      setCardStatusMap(prev => {
        const next = new Map(prev)
        next.delete(deletedId)
        return next
      })
    }
    window.addEventListener('card-deleted', handleCardDeleted)
    return () => window.removeEventListener('card-deleted', handleCardDeleted)
  }, [])

  // Compute session stats derived from cardStatusMap
  const stats = useMemo(() => {
    return computeSessionStats(cardStatusMap)
  }, [cardStatusMap])

  // Current active card item
  const currentCard = specificCardId 
    ? singleCard 
    : (currentIndex < sessionQueue.length ? sessionQueue[currentIndex] : null)

  // Reset card states and trigger Cloze whenever active card presentation instance changes
  useEffect(() => {
    if (!currentCard) return

    setEditFront(currentCard.front || '')
    setEditBack(currentCard.back || '')

    // Determine reverse state safely
    let shouldReverse = false
    if (currentCard.type === 'Glossary') {
      const frontParts = (currentCard.front || '').split('\n')
      const backParts = (currentCard.back || '').split('\n')
      if (frontParts.length >= 2 && backParts.length >= 2) {
        shouldReverse = Math.random() > 0.5
      }
    } else if (currentCard.type === 'Ready Versions') {
      if (currentCard.back && currentCard.back.trim()) {
        shouldReverse = Math.random() > 0.5
      }
    }
    setIsReversed(shouldReverse)

    setShowAnswer(false)
    setElapsedSeconds(0)
    setLiveElapsedMs(0)
    setIsEditingMode(false)

    if (currentCard.type === 'Useful Expressions') {
      setClozeContext('')
      setClozeError(null)
      setClozeLoading(true)
      setTimerStartTime(null) // Timing has NOT started yet during generation

      const reqId = ++clozeReqIdRef.current

      window.ipcRenderer.generateRevisionCloze({ front: currentCard.front, back: currentCard.back })
        .then(res => {
          if (reqId !== clozeReqIdRef.current) return
          setClozeLoading(false)
          if (res.success && res.result) {
            setClozeContext(res.result)
            if (isActive) {
              playClozeReadySound()
            }
            setTimerStartTime(Date.now())
            setLiveElapsedMs(0)
          } else {
            setClozeError(res.error || 'Failed to generate cloze context.')
            setTimerStartTime(Date.now())
            setLiveElapsedMs(0)
          }
        })
        .catch((err: any) => {
          if (reqId !== clozeReqIdRef.current) return
          setClozeLoading(false)
          setClozeError(err?.message || 'Failed to generate cloze context.')
          setTimerStartTime(Date.now())
          setLiveElapsedMs(0)
        })
    } else {
      setClozeContext('')
      setClozeError(null)
      setClozeLoading(false)
      setTimerStartTime(Date.now())
      setLiveElapsedMs(0)
    }
  }, [currentCard?._sessionKey])

  const handleRetryCloze = async () => {
    if (!currentCard) return
    setClozeLoading(true)
    setClozeError(null)
    setTimerStartTime(null)
    setLiveElapsedMs(0)
    const reqId = ++clozeReqIdRef.current
    try {
      const res = await window.ipcRenderer.generateRevisionCloze({ front: currentCard.front, back: currentCard.back })
      if (reqId !== clozeReqIdRef.current) return
      if (res.success && res.result) {
        setClozeContext(res.result)
        if (isActive) playClozeReadySound()
        setTimerStartTime(Date.now())
        setLiveElapsedMs(0)
      } else {
        setClozeError(res.error || 'Failed to generate cloze context.')
        setTimerStartTime(Date.now())
      }
    } catch (err: any) {
      if (reqId !== clozeReqIdRef.current) return
      setClozeError(err?.message || 'Failed to generate cloze context.')
      setTimerStartTime(Date.now())
    } finally {
      if (reqId === clozeReqIdRef.current) {
        setClozeLoading(false)
      }
    }
  }

  // Live Timer Effect
  useEffect(() => {
    let intervalId: any
    if (isActive && timerStartTime !== null && !showAnswer && !isEditingMode && !clozeLoading) {
      intervalId = setInterval(() => {
        setLiveElapsedMs(Date.now() - timerStartTime)
      }, 50)
    }
    return () => clearInterval(intervalId)
  }, [timerStartTime, showAnswer, isEditingMode, clozeLoading, isActive])

  // Reset timer when switching back to the revision tab if card is already ready
  useEffect(() => {
    if (isActive && !showAnswer && !isEditingMode && !clozeLoading && timerStartTime !== null) {
      setTimerStartTime(Date.now())
      setLiveElapsedMs(0)
    }
  }, [isActive])

  const currentElapsedSeconds = liveElapsedMs / 1000

  const getRatingForTime = (timeInSecs: number) => {
    if (timeInSecs <= easyThreshold) return 'easy'
    if (timeInSecs <= goodThreshold) return 'good'
    return 'hard'
  }

  const getRatingBadgeUI = (timeInSecs: number) => {
    const r = getRatingForTime(timeInSecs)
    if (r === 'easy') return { label: 'Easy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: '⚡' }
    if (r === 'good') return { label: 'Good', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', icon: '👍' }
    return { label: 'Hard', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: '🐢' }
  }

  const handleSkipCard = () => {
    if (specificCardId || !currentCard) return
    const res = applySkipToQueue(sessionQueue, currentIndex)
    setSessionQueue(res.nextQueue)
  }

  const handleShuffle = () => {
    if (specificCardId || !currentCard) return
    const res = applyShuffleToQueue(sessionQueue, currentIndex)
    if (res.shuffledCount <= 1) {
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: 'Only 1 card left, no need to shuffle' } 
      }))
      return
    }

    setIsShuffling(true)
    setTimeout(() => setIsShuffling(false), 500)

    setSessionQueue(res.nextQueue)

    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: { message: `Shuffled ${res.shuffledCount} remaining cards` } 
    }))
  }

  const handleShowAnswer = () => {
    if (clozeLoading) return
    setShowAnswer(true)
    const duration = timerStartTime ? Math.max(0.1, (Date.now() - timerStartTime) / 1000) : 0.1
    setElapsedSeconds(duration)
  }

  const handleReview = async (isCorrect: boolean) => {
    if (!currentCard || clozeLoading) return

    // Save any inline edits before moving on
    if (editFront !== currentCard.front || editBack !== currentCard.back) {
      await window.ipcRenderer.updateCardText(currentCard.id, editFront, editBack)
      setSessionQueue(prev => syncCardTextInQueue(prev, currentCard.id, editFront, editBack))
    }

    const timeToRecord = elapsedSeconds > 0 ? elapsedSeconds : (timerStartTime ? Math.max(0.1, (Date.now() - timerStartTime) / 1000) : 0.1)

    if (specificCardId) {
      const rating = isCorrect ? getRatingForTime(timeToRecord) : 'again'
      await window.ipcRenderer.reviewCard(currentCard.id, isCorrect, rating, timeToRecord)
      setSingleCardFinished(true)
      window.dispatchEvent(new Event('stats-updated'))
      return
    }

    const rating = isCorrect ? getRatingForTime(timeToRecord) : 'again'
    await window.ipcRenderer.reviewCard(currentCard.id, isCorrect, rating, timeToRecord)

    // Apply review to state machine
    const res = applyReviewToQueue(sessionQueue, currentIndex, isCorrect, cardStatusMap)
    setSessionQueue(res.nextQueue)
    setCurrentIndex(res.nextIndex)
    setCardStatusMap(res.nextStatusMap)
    setUndoStack(prev => [...prev, res.action])

    // Notify other components (Sidebar, Dashboard) to refresh stats
    window.dispatchEvent(new Event('stats-updated'))
  }

  const handleUndo = async () => {
    if (specificCardId || isEditingMode || clozeLoading || currentIndex === 0 || undoStack.length === 0) return

    await window.ipcRenderer.undoReview()

    const lastAction = undoStack[undoStack.length - 1]
    const res = applyUndoToQueue(sessionQueue, currentIndex, lastAction, cardStatusMap)

    setSessionQueue(res.nextQueue)
    setCurrentIndex(res.nextIndex)
    setCardStatusMap(res.nextStatusMap)
    setUndoStack(prev => prev.slice(0, -1))
    window.dispatchEvent(new Event('stats-updated'))
  }

  const handleSaveEdit = async () => {
    if (!currentCard) return
    await window.ipcRenderer.updateCardText(currentCard.id, editFront, editBack)
    setIsEditingMode(false)
    if (!showAnswer) {
      setTimerStartTime(Date.now())
      setLiveElapsedMs(0)
    }
    // Update local state so it reflects immediately
    if (specificCardId) {
      setSingleCard((prev: any) => prev ? { ...prev, front: editFront, back: editBack } : prev)
    } else {
      setSessionQueue(prev => syncCardTextInQueue(prev, currentCard.id, editFront, editBack))
    }
  }

  const handleCheckDueCards = async () => {
    setIsLoading(true)
    try {
      const cards = await window.ipcRenderer.getDueCards()
      const { queue, statusMap } = initSessionQueue(cards || [])
      setSessionQueue(queue)
      setCurrentIndex(0)
      setCardStatusMap(statusMap)
      setUndoStack([])
      if ((cards || []).length === 0) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'No new cards due for review!' } }))
      }
    } catch (e) {
      console.error('Failed to reload due cards:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!isActive) return // Ignore shortcuts if not the active view
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Ignore shortcuts when typing
      }
      // Ignore shortcuts if a modal dialog is active
      const isModalOpen = !!document.querySelector('.fixed.z-\\[100\\], .fixed.z-\\[101\\], [role="dialog"]')
      if (isModalOpen) return

      if (isActionPressed('revision.flip', e)) {
        e.preventDefault()
        if (isEditingMode || clozeLoading) return
        if (!showAnswer) handleShowAnswer()
        else handleReview(true)
      } else if (isActionPressed('revision.forget', e) && showAnswer && !isEditingMode && !clozeLoading) {
        e.preventDefault()
        handleReview(false)
      } else if (isActionPressed('revision.edit', e) && !isEditingMode && !clozeLoading) {
        e.preventDefault()
        setIsEditingMode(true)
      } else if (isActionPressed('revision.save', e)) {
        e.preventDefault()
        if (isEditingMode) handleSaveEdit()
      } else if (isActionPressed('revision.undo', e) && !specificCardId && !isEditingMode && !clozeLoading) {
        e.preventDefault()
        handleUndo()
      } else if (isActionPressed('revision.cancel', e) && isEditingMode) {
        e.preventDefault()
        setIsEditingMode(false)
        if (currentCard) {
          setEditFront(currentCard.front || '')
          setEditBack(currentCard.back || '')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAnswer, isEditingMode, clozeLoading, currentCard, editFront, editBack, specificCardId, isActive, timerStartTime, elapsedSeconds, currentIndex, sessionQueue, undoStack, isActionPressed])

  const renderCardFront = () => {
    if (!currentCard) return null

    switch (currentCard.type) {
      case 'Useful Expressions': {
        const styleLabel = currentCard.style || 'General'
        if (clozeLoading) {
          return (
            <div className="text-center">
              <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{styleLabel}</div>
              <div className="text-center text-xl font-medium leading-relaxed text-gray-400 animate-pulse">
                Generating contextual cloze from Sketch Engine...
              </div>
            </div>
          )
        }
        if (clozeError) {
          return (
            <div className="text-center">
              <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{styleLabel}</div>
              <div className="text-red-500 mb-4">{clozeError}</div>
              <div className="flex gap-4 justify-center">
                <button onClick={handleRetryCloze} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 rounded-full font-medium text-sm transition-colors">
                  Retry
                </button>
                <button onClick={handleSkipCard} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 rounded-full font-medium text-sm transition-colors">
                  Skip Card
                </button>
              </div>
            </div>
          )
        }
        if (clozeContext) {
          return (
            <div className="text-center">
              <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{styleLabel}</div>
              <div className="text-center text-xl font-medium leading-relaxed">
                {clozeContext}
              </div>
            </div>
          )
        }
        return (
          <div className="text-center">
            <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{styleLabel}</div>
            <div className="text-center text-2xl font-bold">{currentCard.front}</div>
          </div>
        )
      }

      case 'Glossary': {
        const frontParts = (currentCard.front || '').split('\n')
        const backParts = (currentCard.back || '').split('\n')
        let questionTop = isReversed ? (frontParts[1] || frontParts[0] || '') : (frontParts[0] || '')
        let questionBottom = isReversed ? (backParts[1] || backParts[0] || '') : (backParts[0] || '')
        const glossaryTag = currentCard.label || currentCard.sourceContext || 'General'

        return (
          <div className="text-center">
            <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{glossaryTag}</div>
            <div className="text-3xl font-bold mb-4">{questionTop}</div>
            <div className="text-xl text-gray-500">{questionBottom}</div>
          </div>
        )
      }

      case 'Daily Words':
        return (
          <div className="text-center flex flex-col items-center">
            {currentCard.imageUrl && (
              <img 
                src={currentCard.imageUrl.startsWith('http') ? currentCard.imageUrl : `local-asset://${currentCard.imageUrl}`} 
                className="h-48 w-auto object-contain rounded-xl shadow-sm mb-6" 
                alt="Card" 
              />
            )}
            <div className="text-3xl font-bold">{currentCard.front}</div>
          </div>
        )

      case 'Ready Versions': {
        const questionText = isReversed ? (currentCard.back || currentCard.front) : currentCard.front
        return (
          <div className="text-center">
            {currentCard.label && (
              <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{currentCard.label}</div>
            )}
            <div className="text-3xl font-bold">{questionText}</div>
          </div>
        )
      }

      default:
        return <div className="text-center text-3xl font-bold">{currentCard.front}</div>
    }
  }

  const renderCardBack = () => {
    if (!currentCard) return null

    switch (currentCard.type) {
      case 'Useful Expressions':
        return (
          <div className="text-center">
            <div className="text-2xl font-bold mb-4 text-purple-600 dark:text-purple-400">{currentCard.front}</div>
            <div className="text-lg text-gray-500">{currentCard.back}</div>
          </div>
        )
      
      case 'Glossary': {
        const frontParts = (currentCard.front || '').split('\n')
        const backParts = (currentCard.back || '').split('\n')
        let answerTop = isReversed ? (frontParts[0] || '') : (frontParts[1] || frontParts[0] || '')
        let answerBottom = isReversed ? (backParts[0] || '') : (backParts[1] || backParts[0] || '')

        return (
          <div className="text-center">
            <div className="text-2xl font-bold mb-4">{answerTop}</div>
            <div className="text-lg text-gray-500">{answerBottom}</div>
          </div>
        )
      }

      case 'Ready Versions': {
        const answerText = isReversed ? currentCard.front : currentCard.back
        return (
          <div className="text-center">
            <div className="text-2xl font-bold">{answerText}</div>
          </div>
        )
      }

      case 'Daily Words':
      default:
        return <div className="text-center text-2xl font-bold">{currentCard.back}</div>
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-400">Loading due cards...</p>
      </div>
    )
  }

  // If in single card mode and finished
  if (specificCardId && singleCardFinished) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-500">
        <div className="text-6xl mb-6">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Card Review Complete</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          This card has been reviewed and scheduled for spaced repetition.
        </p>
      </div>
    )
  }

  // If in regular session and all cards are finished
  if (!specificCardId && (sessionQueue.length === 0 || currentIndex >= sessionQueue.length)) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-500">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're all caught up!</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
          You've finished all your reviews for today. Great job! Come back tomorrow or add some new cards.
        </p>
        <button
          onClick={handleCheckDueCards}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Check for Due Cards
        </button>
      </div>
    )
  }

  const totalSessionCards = stats.memorized + stats.forgotten + stats.toReview

  return (
    <div className="h-full flex flex-col items-center animate-in fade-in duration-500 max-w-3xl mx-auto w-full pt-8">
      {/* Progress Bar */}
      {!specificCardId && (
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex-1 flex items-center gap-6 text-xs font-medium text-gray-500 justify-center pl-7">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-800 dark:bg-gray-200"></span> Reviewed {stats.memorized}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span> Second Review {stats.forgotten}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700"></span> To Review {stats.toReview}</span>
            </div>
            <button 
              onClick={handleShuffle} 
              className={`w-7 h-7 shrink-0 flex items-center justify-center text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 bg-white dark:bg-[#1f2028] hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-full shadow-sm border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors ${
                isShuffling ? 'text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-600' : ''
              }`}
              title="Shuffle Remaining Cards"
            >
              <Shuffle className={`w-3.5 h-3.5 transition-transform duration-500 ${isShuffling ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 flex overflow-hidden">
            {totalSessionCards > 0 ? (
              <>
                <div className="bg-gray-800 dark:bg-gray-200 h-full transition-all duration-300" style={{ width: `${(stats.memorized / totalSessionCards) * 100}%` }} />
                <div className="bg-red-400 h-full transition-all duration-300" style={{ width: `${(stats.forgotten / totalSessionCards) * 100}%` }} />
                <div className="bg-gray-200 dark:bg-gray-700 h-full transition-all duration-300" style={{ width: `${(stats.toReview / totalSessionCards) * 100}%` }} />
              </>
            ) : (
              <div className="bg-gray-200 dark:bg-gray-800 h-full w-full" />
            )}
          </div>
        </div>
      )}
      
      {currentCard && (
        <div className="w-full text-center text-sm font-bold text-gray-400 mb-2 tracking-widest uppercase relative flex items-center justify-center gap-2">
          <span>{currentCard.type}</span>
          {currentCard.type === 'Useful Expressions' && (
            <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold">
              {currentCard.style || 'General'}
            </span>
          )}
          {currentCard.type === 'Glossary' && currentCard.label && (
            <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold">
              {currentCard.label}
            </span>
          )}
          {currentCard.type === 'Ready Versions' && currentCard.label && (
            <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold">
              {currentCard.label}
            </span>
          )}
          {specificCardId && (
            <span className="text-xs text-purple-500 font-medium">(Single Review)</span>
          )}
        </div>
      )}

      {currentCard && (
        <div className="w-full flex-1 flex flex-col min-h-[400px] relative items-center">
          
          {/* The Card */}
          <div className="w-full bg-white dark:bg-[#1f2028] p-10 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col min-h-[300px] relative mb-6">
            
            {/* Timer Badge */}
            {!clozeLoading && timerStartTime !== null && (
              <div className={`absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider transition-colors duration-300 ${getRatingBadgeUI(showAnswer ? elapsedSeconds : currentElapsedSeconds).color}`}>
                <span className={showAnswer ? "" : "animate-pulse"}>{getRatingBadgeUI(showAnswer ? elapsedSeconds : currentElapsedSeconds).icon}</span>
                <span className="font-mono">{(showAnswer ? elapsedSeconds : currentElapsedSeconds).toFixed(1)}s</span>
              </div>
            )}

            {/* Edit Button */}
            {!clozeLoading && (
              <button
                onClick={() => {
                  if (isEditingMode) {
                    setIsEditingMode(false)
                    if (!showAnswer) {
                      setTimerStartTime(Date.now())
                      setLiveElapsedMs(0)
                    }
                  } else {
                    setIsEditingMode(true)
                  }
                }}
                className="absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
                title={`Edit Card (${getShortcutDisplay('revision.edit')})`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}

            {/* Front Side */}
            <div className="w-full flex flex-col flex-1 items-center justify-center min-h-[150px]">
              {isEditingMode ? (
                <textarea
                  value={editFront}
                  onChange={e => setEditFront(e.target.value)}
                  className="w-full text-center text-xl font-bold bg-transparent border-b-2 border-dashed border-gray-300 focus:border-purple-500 outline-none resize-none min-h-[100px]"
                  placeholder="Front Text"
                />
              ) : (
                renderCardFront()
              )}
            </div>

            {!showAnswer && !isEditingMode ? (
              <div className="mt-8 pt-4 border-t border-dashed border-transparent flex justify-center w-full">
                {!clozeLoading && (
                  <button
                    onClick={handleShowAnswer}
                    className="text-gray-400 font-bold hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm flex items-center gap-1"
                  >
                    <span>↓</span> Show Answers ({getShortcutDisplay('revision.flip')})
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Divider */}
                <div className="w-full h-px border-b border-dashed border-gray-200 dark:border-gray-800 my-8"></div>
                
                {/* Back Side */}
                <div className="w-full flex flex-col min-h-[100px] animate-in fade-in duration-300 relative pb-10">
                  {isEditingMode ? (
                    <textarea
                      value={editBack}
                      onChange={e => setEditBack(e.target.value)}
                      className="w-full flex-1 min-h-[100px] bg-transparent border-2 border-dashed border-gray-300 dark:border-gray-700 focus:border-purple-500 rounded-xl outline-none resize-none text-lg p-2"
                      placeholder="Back Text / Translation"
                    />
                  ) : (
                    <div className="w-full flex-1 min-h-[100px] flex items-center justify-center">
                      {renderCardBack()}
                    </div>
                  )}
                  
                  {/* Footer area inside card */}
                  <div className="absolute bottom-0 left-0 text-sm font-medium text-gray-400 flex items-center gap-2">
                    {currentCard.encounterCount || 0} Reviews
                  </div>

                  <div className="absolute bottom-0 right-0">
                    {isEditingMode && (
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        <Save className="w-4 h-4" />
                        Save ({getShortcutDisplay('revision.save')})
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons Below Card */}
          {showAnswer && !isEditingMode && (
            <div className="flex gap-4 animate-in slide-in-from-bottom-4 duration-300">
              <button
                onClick={() => handleReview(false)}
                className="px-8 py-3 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-full font-bold text-base transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="text-lg leading-none">×</span> Forget ({getShortcutDisplay('revision.forget')})
              </button>
              <button
                onClick={() => handleReview(true)}
                className={`px-8 py-3 rounded-full font-bold text-base transition-colors flex items-center gap-2 shadow-sm ${
                  getRatingForTime(elapsedSeconds) === 'easy' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' :
                  getRatingForTime(elapsedSeconds) === 'good' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                  'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                <span className="text-lg leading-none">√</span> 
                Got it ({getShortcutDisplay('revision.flip')})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
