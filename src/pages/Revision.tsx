import React, { useState, useEffect, useMemo } from 'react'
import { Save } from 'lucide-react'

interface RevisionProps {
  specificCardId?: number
  isActive?: boolean
}

export const Revision: React.FC<RevisionProps> = ({ specificCardId, isActive = true }) => {
  const [dueCards, setDueCards] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingMode, setIsEditingMode] = useState(false)

  // Inline editing state
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  const [clozeContext, setClozeContext] = useState<string>('')
  const [clozeLoading, setClozeLoading] = useState(false)
  const [clozeError, setClozeError] = useState<string | null>(null)

  // Reverse State for Glossary and Ready Versions
  const [isReversed, setIsReversed] = useState<boolean>(false)

  const [stats, setStats] = useState({ memorized: 0, forgotten: 0, toReview: 0 })

  const loadCardsAndStats = async (randomize = false) => {
    setIsLoading(true)
    try {
      if (specificCardId) {
        const card = await window.ipcRenderer.getCard(specificCardId)
        setDueCards(card ? [card] : [])
        setClozeContext('')
        setClozeError(null)
      } else {
        const cards = await window.ipcRenderer.getDueCards(randomize)
        setDueCards(cards || [])
        setCurrentIndex(0)
        const revStats = await window.ipcRenderer.getRevisionStats()
        setStats(revStats || { memorized: 0, forgotten: 0, toReview: 0 })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCardsAndStats()
  }, [specificCardId])

  useEffect(() => {
    const fetchRevStats = async () => {
      if (!specificCardId) {
        const revStats = await window.ipcRenderer.getRevisionStats()
        setStats(revStats || { memorized: 0, forgotten: 0, toReview: 0 })
      }
    }
    window.addEventListener('stats-updated', fetchRevStats)
    return () => window.removeEventListener('stats-updated', fetchRevStats)
  }, [specificCardId])

  const currentCard = dueCards[currentIndex]

  // Reset local edit states when card changes
  useEffect(() => {
    if (currentCard) {
      setEditFront(currentCard.front || '')
      setEditBack(currentCard.back || '')
      
      if (currentCard.type === 'Glossary' || currentCard.type === 'Ready Versions') {
        setIsReversed(Math.random() > 0.5)
      } else {
        setIsReversed(false)
      }
      
      if (currentCard.type === 'Useful Expressions' && !isEditingMode) {
        generateFreshCloze(currentCard)
      } else {
        setClozeContext('')
        setClozeError(null)
      }
      setShowAnswer(false)
    }
  }, [currentCard])

  const generateFreshCloze = async (card: any) => {
    setClozeLoading(true)
    setClozeError(null)
    const res = await window.ipcRenderer.generateRevisionCloze({ front: card.front, back: card.back })
    if (res.success && res.result) {
      setClozeContext(res.result)
    } else {
      setClozeError(res.error || 'Failed to generate cloze context.')
    }
    setClozeLoading(false)
  }

  const handleSkipCard = () => {
    if (dueCards.length <= 1) {
      setDueCards([])
    } else {
      setDueCards(prev => prev.slice(1))
    }
  }

  const handleShowAnswer = () => {
    setShowAnswer(true)
  }

  const handleReview = async (isCorrect: boolean) => {
    if (!currentCard) return

    // Save any inline edits before moving on
    if (editFront !== currentCard.front || editBack !== currentCard.back) {
      await window.ipcRenderer.updateCardText(currentCard.id, editFront, editBack)
    }

    if (!specificCardId) {
      // Submit review log and update SM-2 only if not in isolated review mode
      await window.ipcRenderer.reviewCard(currentCard.id, isCorrect)
    }
    
    // Notify sidebar to refresh stats
    window.dispatchEvent(new Event('stats-updated'))

    // Move to next card
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      if (!specificCardId) {
        // Re-fetch to see if more due cards exist (limit 50 per fetch)
        const moreCards = await window.ipcRenderer.getDueCards()
        setDueCards(moreCards || [])
        setCurrentIndex(0)
      } else {
        // Finished specific card review
        setDueCards([])
      }
    }
  }

  const handleSaveEdit = async () => {
    if (!currentCard) return
    await window.ipcRenderer.updateCardText(currentCard.id, editFront, editBack)
    setIsEditingMode(false)
    // Update local state so it reflects immediately
    setDueCards(prev => prev.map(c => c.id === currentCard.id ? { ...c, front: editFront, back: editBack } : c))
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
        if (isEditingMode) return
        if (!showAnswer) handleShowAnswer()
        else handleReview(true)
      }
      if (e.key.toLowerCase() === 'f' && showAnswer && !isEditingMode) {
        e.preventDefault()
        handleReview(false)
      }
      if (e.key.toLowerCase() === 'e' && !isEditingMode) {
        e.preventDefault()
        setIsEditingMode(true)
      }
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (isEditingMode) handleSaveEdit()
      }
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !specificCardId && !isEditingMode) {
        e.preventDefault()
        await window.ipcRenderer.undoReview()
        await loadCardsAndStats() // reload state
        setCurrentIndex(0)
        window.dispatchEvent(new Event('stats-updated'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAnswer, isEditingMode, currentCard, editFront, editBack, specificCardId, isActive])

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
                <button onClick={() => currentCard && generateFreshCloze(currentCard)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-medium text-sm transition-colors">
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

  if (dueCards.length === 0) {
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

  return (
    <div className="h-full flex flex-col items-center animate-in fade-in duration-500 max-w-3xl mx-auto w-full pt-8">
      {/* Progress Bar */}
      {!specificCardId && (
        <div className="w-full mb-8 relative">
          <button 
            onClick={() => loadCardsAndStats(true)} 
            className="absolute -top-2 right-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-white dark:bg-[#1f2028] p-1.5 rounded-full shadow-sm border border-gray-100 dark:border-gray-800"
            title="Shuffle Due Cards"
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
            {stats.memorized + stats.forgotten + stats.toReview > 0 ? (
              <>
                <div className="bg-gray-800 dark:bg-gray-200 h-full transition-all duration-300" style={{ width: `${(stats.memorized / (stats.memorized + stats.forgotten + stats.toReview)) * 100}%` }} />
                <div className="bg-red-400 h-full transition-all duration-300" style={{ width: `${(stats.forgotten / (stats.memorized + stats.forgotten + stats.toReview)) * 100}%` }} />
                <div className="bg-gray-200 dark:bg-gray-700 h-full transition-all duration-300" style={{ width: `${(stats.toReview / (stats.memorized + stats.forgotten + stats.toReview)) * 100}%` }} />
              </>
            ) : (
              <div className="bg-gray-200 dark:bg-gray-800 h-full w-full" />
            )}
          </div>
        </div>
      )}
      
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

      <div className="w-full flex-1 flex flex-col min-h-[400px] relative items-center">
        
        {/* The Card */}
        <div className="w-full bg-white dark:bg-[#1f2028] p-10 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col min-h-[300px] relative mb-6">
          
          {/* Edit Button */}
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className="absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
            title="Edit Card (E)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>

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
              className="px-8 py-3 bg-gray-100 dark:bg-[#25262c] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2b32] rounded-full font-bold text-base transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="text-lg leading-none">×</span> Forget
            </button>
            <button
              onClick={() => handleReview(true)}
              className="px-8 py-3 bg-gray-100 dark:bg-[#25262c] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2b32] rounded-full font-bold text-base transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="text-lg leading-none">√</span> Got it
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
