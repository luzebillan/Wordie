import React, { useState, useEffect, useMemo } from 'react'

interface RevisionProps {
  specificCardId?: number
}

export const Revision: React.FC<RevisionProps> = ({ specificCardId }) => {
  const [dueCards, setDueCards] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingMode, setIsEditingMode] = useState(false)

  // Inline editing state
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  useEffect(() => {
    const loadCards = async () => {
      setIsLoading(true)
      try {
        if (specificCardId) {
          const card = await window.ipcRenderer.getCard(specificCardId)
          setDueCards(card ? [card] : [])
        } else {
          const cards = await window.ipcRenderer.getDueCards()
          setDueCards(cards || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    loadCards()
  }, [specificCardId])

  const currentCard = dueCards[currentIndex]

  // Reset local edit states when card changes
  useEffect(() => {
    if (currentCard) {
      setEditFront(currentCard.front || '')
      setEditBack(currentCard.back || '')
      setShowAnswer(false)
    }
  }, [currentCard])

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

  const renderCardFront = () => {
    if (!currentCard) return null

    switch (currentCard.type) {
      case 'Useful Expressions':
        if (currentCard.sourceContext) {
          // Cloze deletion using regex
          // Escape regex special chars from front word
          const escapedFront = (currentCard.front || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`(${escapedFront})`, 'gi')
          const clozeContext = currentCard.sourceContext.replace(regex, '[______]')
          return (
            <div className="text-center text-xl font-medium leading-relaxed">
              {clozeContext}
            </div>
          )
        }
        return <div className="text-center text-2xl font-bold">{currentCard.front}</div>

      case 'Glossary':
        return (
          <div className="text-center">
            <div className="text-sm text-purple-500 font-bold mb-2 uppercase tracking-widest">{currentCard.sourceContext || 'General'}</div>
            <div className="text-3xl font-bold">{currentCard.front}</div>
          </div>
        )

      case 'Daily Words':
        return (
          <div className="text-center flex flex-col items-center">
            {currentCard.imageUrl && !currentCard.imageUrl.startsWith('http') && (
              <img src={`local-asset://${currentCard.imageUrl}`} className="h-48 w-auto object-contain rounded-xl shadow-sm mb-6" alt="Card" />
            )}
            <div className="text-3xl font-bold">{currentCard.front}</div>
          </div>
        )

      case 'Ready Versions':
      default:
        return <div className="text-center text-3xl font-bold">{currentCard.front}</div>
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
      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mb-8">
        <div 
          className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
          style={{ width: `${(currentIndex / dueCards.length) * 100}%` }}
        />
      </div>
      
      <div className="w-full text-center text-sm font-bold text-gray-400 mb-2 tracking-widest uppercase relative">
        {currentCard.type}
        {specificCardId && (
          <span className="ml-2 text-xs text-purple-500">(Single Review)</span>
        )}
      </div>

      <div className="w-full flex-1 flex flex-col min-h-[400px] relative">
        {/* Edit Button */}
        <button
          onClick={() => setIsEditingMode(!isEditingMode)}
          className="absolute top-4 right-4 z-10 p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"
          title="Edit Card"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>

        {/* Front Side */}
        <div className="w-full bg-white dark:bg-[#1f2028] p-10 rounded-t-3xl border border-b-0 border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center min-h-[200px]">
          {isEditingMode ? (
            <textarea
              value={editFront}
              onChange={e => setEditFront(e.target.value)}
              className="w-full text-center text-3xl font-bold bg-transparent border-b-2 border-dashed border-purple-300 dark:border-purple-800/50 focus:border-purple-500 outline-none resize-none overflow-hidden min-h-[100px] transition-colors"
              placeholder="Front Text"
            />
          ) : (
            renderCardFront()
          )}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent opacity-50 relative">
          <div className="absolute left-1/2 -top-3 -translate-x-1/2 bg-gray-100 dark:bg-[#16171d] px-4 text-gray-400 text-xs tracking-widest uppercase">
            {showAnswer ? 'Answer' : 'Question'}
          </div>
        </div>

        {/* Back Side (Answer) */}
        <div className={`w-full bg-white dark:bg-[#1f2028] p-10 rounded-b-3xl border border-t-0 border-gray-200 dark:border-gray-800 shadow-sm flex flex-col min-h-[200px] transition-opacity duration-300 ${(showAnswer || isEditingMode) ? 'opacity-100' : 'opacity-0 select-none pointer-events-none'}`}>
          {(showAnswer || isEditingMode) && (
            <div className="flex flex-col gap-4 w-full h-full">
              {isEditingMode ? (
                <textarea
                  value={editBack}
                  onChange={e => setEditBack(e.target.value)}
                  className="w-full flex-1 min-h-[120px] bg-transparent border-2 border-dashed border-purple-300 dark:border-purple-800/50 p-4 focus:border-purple-500 rounded-xl outline-none resize-none transition-colors text-lg"
                  placeholder="Back Text / Translation"
                />
              ) : (
                <>
                  {/* Inline Edit Front for SRS */}
                  {currentCard.type === 'Useful Expressions' && currentCard.sourceContext && (
                    <div>
                      <label className="text-xs text-gray-400 font-bold mb-1 block">Target Word</label>
                      <input
                        value={editFront}
                        onChange={e => setEditFront(e.target.value)}
                        className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 rounded-lg outline-none transition-colors text-lg font-bold"
                      />
                    </div>
                  )}
                  
                  {/* Inline Edit Back for SRS */}
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs text-gray-400 font-bold mb-1 block">Explanation / Translation</label>
                    <textarea
                      value={editBack}
                      onChange={e => setEditBack(e.target.value)}
                      className="w-full flex-1 min-h-[120px] p-2 bg-gray-50 dark:bg-black/20 border border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-purple-500 rounded-lg outline-none resize-none transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full py-8">
        {isEditingMode ? (
          <button
            onClick={handleSaveEdit}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-lg transition-transform shadow-xl shadow-purple-500/30 active:scale-95"
          >
            Save Changes
          </button>
        ) : !showAnswer ? (
          <button
            onClick={handleShowAnswer}
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-xl shadow-gray-900/20 dark:shadow-white/10"
          >
            Show Answer
          </button>
        ) : (
          <div className="flex gap-4 w-full animate-in slide-in-from-bottom-4 duration-300">
            <button
              onClick={() => handleReview(false)}
              className="flex-1 py-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-2xl font-bold text-lg transition-colors border border-red-200 dark:border-red-900/50"
            >
              Forget
            </button>
            <button
              onClick={() => handleReview(true)}
              className="flex-1 py-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded-2xl font-bold text-lg transition-colors border border-emerald-200 dark:border-emerald-900/50"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
