import React, { useEffect, useState } from 'react'
import { CardEditForm } from './CardEditForm'

interface CardPreviewModalProps {
  cardId: number | null
  context?: 'practice' | 'default'
  initialEditMode?: boolean
  onClose: () => void
}

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({ cardId, context = 'default', initialEditMode = false, onClose }) => {
  const [card, setCard] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(initialEditMode)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editType, setEditType] = useState('')
  const [synonyms, setSynonyms] = useState<any[]>([])
  const [isSearchingSynonyms, setIsSearchingSynonyms] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (cardId !== null) {
      setIsLoading(true)
      window.ipcRenderer.getCard(cardId).then(data => {
        setCard(data)
        setEditFront(data?.front || '')
        setEditBack(data?.back || '')
        setEditLabel(data?.label || '')
        setEditType(data?.type || '')
        setIsEditingMode(initialEditMode)
        setIsLoading(false)
        setSynonyms([])
        setIsSearchingSynonyms(false)
        setShowDeleteConfirm(false)
      })
    } else {
      setCard(null)
    }
  }, [cardId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Ignore shortcuts when typing
      }
      if (e.key === 'Escape') onClose()
      if (e.key.toLowerCase() === 'e' && !isEditingMode) {
        e.preventDefault()
        setIsEditingMode(true)
      }
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isEditingMode, editFront, editBack, editLabel, editType, card])

  const handleSaveEdit = async (updates: { front?: string, back?: string, label?: string, type?: string, style?: string, imageUrl?: string }) => {
    if (!card) return
    try {
      await window.ipcRenderer.updateCard(card.id, updates)
      setCard({ ...card, ...updates })
      setIsEditingMode(false)
      window.dispatchEvent(new Event('stats-updated'))
    } catch (e) {
      console.error(e)
    }
  }

  const handleFindSynonyms = async () => {
    if (!card) return
    setIsSearchingSynonyms(true)
    try {
      const results = await window.ipcRenderer.findSimilarCards(card.front, card.back, card.type, true)
      const filtered = results.filter((r: any) => r.id !== card.id).slice(0, 5)
      setSynonyms(filtered)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearchingSynonyms(false)
    }
  }

  const handleDeleteCard = async () => {
    if (!card) return
    try {
      await window.ipcRenderer.deleteCard(card.id)
      window.dispatchEvent(new CustomEvent('card-deleted', { detail: card.id }))
      window.dispatchEvent(new CustomEvent('stats-updated'))
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  const renderCardFront = () => {
    if (!card) return null
    switch (card.type) {
      case 'Useful Expressions':
        return <div className="text-center text-3xl font-bold text-purple-600 dark:text-purple-400">{card.front}</div>
      case 'Glossary': {
        const frontParts = (card.front || '').split('\n')
        const backParts = (card.back || '').split('\n')
        let questionTop = (frontParts[0] || '')
        let questionBottom = (backParts[0] || '')
        return (
          <div className="text-center">
            <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{card.sourceContext || 'General'}</div>
            <div className="text-3xl font-bold mb-4">{questionTop}</div>
            <div className="text-xl text-gray-500">{questionBottom}</div>
          </div>
        )
      }
      case 'Daily Words':
        return (
          <div className="text-center flex flex-col items-center">
            {card.imageUrl && !card.imageUrl.startsWith('http') && (
              <img src={`local-asset://${card.imageUrl}`} className="h-48 w-auto object-contain rounded-xl shadow-sm mb-6" alt="Card" />
            )}
            <div className="text-3xl font-bold">{card.front}</div>
          </div>
        )
      case 'Ready Versions': {
        return (
          <div className="text-center">
            {card.label && (
              <div className="text-sm text-purple-500 font-bold mb-4 uppercase tracking-widest">{card.label}</div>
            )}
            <div className="text-3xl font-bold">{card.front}</div>
          </div>
        )
      }
      default:
        return <div className="text-center text-3xl font-bold">{card.front}</div>
    }
  }

  const renderCardBack = () => {
    if (!card) return null
    switch (card.type) {
      case 'Useful Expressions':
        return (
          <div className="text-center">
            <div className="text-xl text-gray-500">{card.back}</div>
          </div>
        )
      case 'Glossary': {
        const frontParts = (card.front || '').split('\n')
        const backParts = (card.back || '').split('\n')
        let answerTop = (frontParts[1] || '')
        let answerBottom = (backParts[1] || '')
        return (
          <div className="text-center">
            <div className="text-2xl font-bold mb-4">{answerTop}</div>
            <div className="text-lg text-gray-500">{answerBottom}</div>
          </div>
        )
      }
      case 'Ready Versions': {
        return (
          <div className="text-center">
            <div className="text-2xl font-bold">{card.back}</div>
          </div>
        )
      }
      case 'Daily Words':
      default:
        return <div className="text-center text-2xl font-bold">{card.back}</div>
    }
  }

  if (!cardId) return null

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-card-fade" 
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 z-[101] w-full max-w-3xl bg-white dark:bg-[#1f2028] p-10 md:p-12 rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-2xl animate-card-pop flex flex-col min-h-[500px]">
        
        {/* Top Right Action Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {/* Edit Button */}
          <button 
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`p-2 rounded-full transition-colors ${isEditingMode ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
            title="Edit Card (E)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Close (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse">Loading card details...</div>
        ) : card ? (
          isEditingMode ? (
            <div className="flex-1 overflow-hidden">
              <CardEditForm 
                card={card} 
                onCancel={() => setIsEditingMode(false)} 
                onSave={handleSaveEdit} 
              />
            </div>
          ) : (
          <>
            {/* Card Attribute UI - Moved to Center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2 w-full max-w-[60%]">
              {card.type} {card.label && card.label !== 'Vocabulary' ? `• ${card.label}` : ''}
            </div>

            {/* Top Left Action Button - Delete */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete Card"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full border border-red-200 dark:border-red-900/50">
                  <span className="text-xs text-red-500 font-bold px-2 whitespace-nowrap">Are you sure?</span>
                  <button
                    onClick={handleDeleteCard}
                    className="p-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400 transition-colors"
                    title="Confirm Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                    title="Cancel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Front Side */}
            <div className="w-full flex flex-col flex-1 items-center justify-center min-h-[150px]">
              {renderCardFront()}
            </div>

            {/* Divider */}
            <div className="w-full h-px border-b border-dashed border-gray-200 dark:border-gray-800 my-8"></div>

            {/* Back Side */}
            <div className="w-full flex flex-col flex-1 relative mt-2">
              <div className="w-full flex-1 flex items-center justify-center">
                {renderCardBack()}
              </div>

              {/* Footer area inside card */}
              <div className="mt-10 flex items-center justify-between w-full text-sm font-medium text-gray-400">
                <div className="flex items-center gap-4">
                  <span>{(card.repetitions || 0) + (card.manualReviewCount || 0)} Reviews</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                  <span>{card.useCount || 0} Uses</span>
                </div>

                {/* +1 Use Count */}
                <div>
                  {context === 'practice' ? (
                    <button 
                      onClick={async () => {
                        try {
                          await window.ipcRenderer.incrementUseCount(card.id)
                          setCard({ ...card, useCount: (card.useCount || 0) + 1 })
                        } catch (e) {
                          console.error(e)
                        }
                      }}
                      className="px-5 py-2 bg-gray-900 hover:bg-black dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                    >
                      +1 Use Count
                    </button>
                  ) : (
                    <button 
                      onClick={async () => {
                        try {
                          await window.ipcRenderer.incrementManualReviewCount(card.id)
                          setCard({ ...card, manualReviewCount: (card.manualReviewCount || 0) + 1 })
                          window.dispatchEvent(new Event('stats-updated'))
                        } catch (e) {
                          console.error(e)
                        }
                      }}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                    >
                      +1 Review Count
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">Card not found</div>
        )}

        {/* Synonyms Container (Floating outside the bottom of the card) */}
        {card && (
          <div className="absolute top-[calc(100%+24px)] left-0 w-full flex flex-col items-center justify-start z-50">
            {synonyms.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-full px-4">
                {synonyms.map(syn => (
                  <div key={syn.id} className="relative group">
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('preview-card', { detail: syn.id }))}
                      className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg text-sm font-bold shadow-lg hover:scale-105 hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-all border border-yellow-200/50 dark:border-yellow-700/30"
                    >
                      {syn.front}
                    </button>
                    {/* Hover Tooltip Card */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none origin-bottom scale-95 group-hover:scale-100">
                        <div className="text-sm font-bold text-gray-900 dark:text-white mb-1 text-center">{syn.front}</div>
                        <div className="text-xs text-gray-500 line-clamp-4 whitespace-pre-wrap text-center">{syn.back}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button 
                onClick={handleFindSynonyms}
                disabled={isSearchingSynonyms}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-xl text-sm font-bold shadow-xl border border-white/10 transition-all flex items-center gap-2"
              >
                {isSearchingSynonyms ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                Explore Synonyms
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
