import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Save } from 'lucide-react'

interface RevisionProps {
  specificCardId?: number
  isActive?: boolean
}

type CardReviewStatus = 'toReview' | 'secondReview' | 'memorized'

export const Revision: React.FC<RevisionProps> = ({ specificCardId, isActive = true }) => {
  // Session Queue State (fixed for this app run)
  const [sessionQueue, setSessionQueue] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardStatusMap, setCardStatusMap] = useState<Map<number, CardReviewStatus>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const sessionInitializedRef = useRef(false)

  // Single card mode state (when viewing/reviewing a specific card from library/search)
  const [singleCard, setSingleCard] = useState<any | null>(null)
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
        const initialCards = cards || []
        setSessionQueue(initialCards)
        setCurrentIndex(0)

        const initialMap = new Map<number, CardReviewStatus>()
        initialCards.forEach((c: any) => {
          initialMap.set(c.id, 'toReview')
        })
        setCardStatusMap(initialMap)
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
        setSingleCard(card || null)
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
    let memorized = 0
    let forgotten = 0
    let toReview = 0
    cardStatusMap.forEach(status => {
      if (status === 'memorized') memorized++
      else if (status === 'secondReview') forgotten++
      else if (status === 'toReview') toReview++
    })
    return { memorized, forgotten, toReview }
  }, [cardStatusMap])

  // Current active card
  const currentCard = specificCardId 
    ? singleCard 
    : (currentIndex < sessionQueue.length ? sessionQueue[currentIndex] : null)

  // Reset card states and trigger Cloze if needed
  useEffect(() => {
    if (!currentCard) return

    setEditFront(currentCard.front || '')
    setEditBack(currentCard.back || '')
    setIsReversed((currentCard.type === 'Glossary' || currentCard.type === 'Ready Versions') ? Math.random() > 0.5 : false)
    setShowAnswer(false)
    setElapsedSeconds(0)
    setLiveElapsedMs(0)
    setIsEditingMode(false)

    let isMounted = true

    if (currentCard.type === 'Useful Expressions') {
      setClozeContext('')
      setClozeError(null)
      setClozeLoading(true)
      setTimerStartTime(null) // Timing has NOT started yet during generation

      window.ipcRenderer.generateRevisionCloze({ front: currentCard.front, back: currentCard.back })
        .then(res => {
          if (!isMounted) return
          setClozeLoading(false)
          if (res.success && res.result) {
            setClozeContext(res.result)
            setTimerStartTime(Date.now())
            setLiveElapsedMs(0)
          } else {
            setClozeError(res.error || 'Failed to generate cloze context.')
            setTimerStartTime(Date.now())
            setLiveElapsedMs(0)
          }
        })
        .catch((err: any) => {
          if (!isMounted) return
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

    return () => {
      isMounted = false
    }
  }, [currentCard?.id])

  const handleRetryCloze = async () => {
    if (!currentCard) return
    setClozeLoading(true)
    setClozeError(null)
    setTimerStartTime(null)
    setLiveElapsedMs(0)
    try {
      const res = await window.ipcRenderer.generateRevisionCloze({ front: currentCard.front, back: currentCard.back })
      if (res.success && res.result) {
        setClozeContext(res.result)
        setTimerStartTime(Date.now())
        setLiveElapsedMs(0)
      } else {
        setClozeError(res.error || 'Failed to generate cloze context.')
        setTimerStartTime(Date.now())
      }
    } catch (err: any) {
      setClozeError(err?.message || 'Failed to generate cloze context.')
      setTimerStartTime(Date.now())
    } finally {
      setClozeLoading(false)
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
    setSessionQueue(prev => {
      const next = [...prev]
      const [skipped] = next.splice(currentIndex, 1)
      next.push(skipped)
      return next
    })
  }

  const handleShuffle = () => {
    if (specificCardId || !currentCard) return
    setSessionQueue(prev => {
      const done = prev.slice(0, currentIndex)
      const remaining = prev.slice(currentIndex)
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      return [...done, ...remaining]
    })
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

    // Update status in session map
    setCardStatusMap(prev => {
      const next = new Map(prev)
      next.set(currentCard.id, isCorrect ? 'memorized' : 'secondReview')
      return next
    })

    if (!isCorrect) {
      // Re-insert card slightly ahead in the queue so it reappears for second review
      setSessionQueue(prev => {
        const next = [...prev]
        const insertIdx = Math.min(currentIndex + 4, next.length)
        next.splice(insertIdx, 0, currentCard)
        return next
      })
    }

    // Advance to next card in session
    setCurrentIndex(prev => prev + 1)

    // Notify other components (Sidebar, Dashboard) to refresh stats
    window.dispatchEvent(new Event('stats-updated'))
  }

  const handleUndo = async () => {
    if (specificCardId || isEditingMode || clozeLoading || currentIndex === 0) return

    await window.ipcRenderer.undoReview()

    const prevIndex = currentIndex - 1
    const prevCard = sessionQueue[prevIndex]

    if (prevCard) {
      setCardStatusMap(prev => {
        const next = new Map(prev)
        const hadPriorEncounter = sessionQueue.slice(0, prevIndex).some(c => c.id === prevCard.id)
        next.set(prevCard.id, hadPriorEncounter ? 'secondReview' : 'toReview')
        return next
      })
    }

    setCurrentIndex(prevIndex)
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
      setSessionQueue(prev => prev.map(c => c.id === currentCard.id ? { ...c, front: editFront, back: editBack } : c))
    }
  }

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!isActive) return // Ignore shortcuts if not the active view
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Ignore shortcuts when typing
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (isEditingMode || clozeLoading) return
        if (!showAnswer) handleShowAnswer()
        else handleReview(true)
      }
      if (e.key.toLowerCase() === 'f' && showAnswer && !isEditingMode && !clozeLoading) {
        e.preventDefault()
        handleReview(false)
      }
      if (e.key.toLowerCase() === 'e' && !isEditingMode && !clozeLoading) {
        e.preventDefault()
        setIsEditingMode(true)
      }
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (isEditingMode) handleSaveEdit()
      }
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !specificCardId && !isEditingMode && !clozeLoading) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAnswer, isEditingMode, clozeLoading, currentCard, editFront, editBack, specificCardId, isActive, timerStartTime, elapsedSeconds, currentIndex, sessionQueue])

  const renderCardFront = () => {
    if (!currentCard) return null

    switch (currentCard.type) {
      case 'Useful Expressions':
        if (clozeLoading) {
          return (
            <div className="text-center text-xl font-medium leading-relaxed text-gray-400 animate-pulse">
              Generating contextual cloze from Sketch Engine...
            </div>
          )
        }
        if (clozeError) {
          return (
            <div className="text-center">
              <div className="text-red-500 mb-4">{clozeError}</div>
              <div className="flex gap-4 justify-center">
                <button onClick={handleRetryCloze} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-medium text-sm transition-colors">
                  Retry
                </button>
                <button onClick={handleSkipCard} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-medium text-sm transition-colors">
                  Skip Card
                </button>
              </div>
            </div>
          )
        }
        if (clozeContext) {
          return (
            <div className="text-center text-xl font-medium leading-relaxed">
              {clozeContext}
            </div>
          )
        }
        return <div className="text-center text-2xl font-bold">{currentCard.front}</div>

      case 'Glossary': {
        const frontParts = (currentCard.front || '').split('\n')
        const backParts = (currentCard.back || '').split('\n')
        let questionTop = isReversed ? (frontParts[1] || '') : (frontParts[0] || '')
        let questionBottom = isReversed ? (backParts[1] || '') : (backParts[0] || '')

        return (
          <div className="text-center">
            <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{currentCard.sourceContext || 'General'}</div>
            <div className="text-3xl font-bold mb-4">{questionTop}</div>
            <div className="text-xl text-gray-500">{questionBottom}</div>
          </div>
        )
      }

      case 'Daily Words':
        return (
          <div className="text-center flex flex-col items-center">
            {currentCard.imageUrl && !currentCard.imageUrl.startsWith('http') && (
              <img src={`local-asset://${currentCard.imageUrl}`} className="h-48 w-auto object-contain rounded-xl shadow-sm mb-6" alt="Card" />
            )}
            <div className="text-3xl font-bold">{currentCard.front}</div>
          </div>
        )

      case 'Ready Versions': {
        const questionText = isReversed ? currentCard.back : currentCard.front
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
        let answerTop = isReversed ? (frontParts[0] || '') : (frontParts[1] || '')
        let answerBottom = isReversed ? (backParts[0] || '') : (backParts[1] || '')

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
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          You've finished all your reviews for today. Great job! Come back tomorrow or add some new cards.
        </p>
      </div>
    )
  }

  const totalSessionCards = stats.memorized + stats.forgotten + stats.toReview

  return (
    <div className="h-full flex flex-col items-center animate-in fade-in duration-500 max-w-3xl mx-auto w-full pt-8">
      {/* Progress Bar */}
      {!specificCardId && (
        <div className="w-full mb-8 relative">
          <button 
            onClick={handleShuffle} 
            className="absolute -top-2 right-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-white dark:bg-[#1f2028] p-1.5 rounded-full shadow-sm border border-gray-100 dark:border-gray-800"
            title="Shuffle Remaining Cards"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <div className="flex items-center gap-6 text-xs font-medium text-gray-500 mb-2 justify-center">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-800 dark:bg-gray-200"></span> Reviewed {stats.memorized}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span> Second Review {stats.forgotten}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700"></span> To Review {stats.toReview}</span>
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
        <div className="w-full text-center text-sm font-bold text-gray-400 mb-2 tracking-widest uppercase relative">
          {currentCard.type}
          {currentCard.type === 'Useful Expressions' && currentCard.label && currentCard.label !== 'Vocabulary' && (
            <span className="ml-3 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 px-2 py-1 rounded">
              {currentCard.label}
            </span>
          )}
          {specificCardId && (
            <span className="ml-2 text-xs text-purple-500">(Single Review)</span>
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
                title="Edit Card (E)"
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

            {!showAnswer && !isEditingMode && !clozeLoading ? (
              <div className="mt-8 pt-4 border-t border-dashed border-transparent flex justify-center w-full">
                <button
                  onClick={handleShowAnswer}
                  className="text-gray-400 font-bold hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm flex items-center gap-1"
                >
                  <span>↓</span> Show Answers
                </button>
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
                        Save
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
                <span className="text-lg leading-none">×</span> Forget
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
                Got it ({getRatingBadgeUI(elapsedSeconds).label})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
