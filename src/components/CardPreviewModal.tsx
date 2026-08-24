import React, { useEffect, useState } from 'react'
import { CardEditForm } from './CardEditForm'
import { TaxonomyTagBadge } from './TaxonomyTagBadge'
import { useShortcuts } from '../hooks/useShortcuts'
import { Modal, ModalHeader, ModalBody } from './ui/Modal'
import { Edit2, Trash2, Check, X, Sparkles, Volume2 } from 'lucide-react'

interface CardPreviewModalProps {
  cardId: number | null
  context?: 'practice' | 'default'
  initialEditMode?: boolean
  onClose: () => void
}

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({
  cardId,
  context = 'default',
  initialEditMode = false,
  onClose
}) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const [card, setCard] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(initialEditMode)
  const [synonyms, setSynonyms] = useState<any[]>([])
  const [isSearchingSynonyms, setIsSearchingSynonyms] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (cardId !== null) {
      setIsLoading(true)
      window.ipcRenderer.getCard(cardId).then(data => {
        setCard(data)
        setIsLoading(false)
        setIsEditingMode(initialEditMode)
        setSynonyms([])
        setIsSearchingSynonyms(false)
        setShowDeleteConfirm(false)
      })
    } else {
      setCard(null)
    }
  }, [cardId, initialEditMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (isActionPressed('revision.edit', e) && !isEditingMode) {
        e.preventDefault()
        setIsEditingMode(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditingMode, isActionPressed])

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
      const results = await window.ipcRenderer.findSimilarCards(card.front, card.back, card.type, true, card.sourceContext || '')
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
        return <div className="text-center text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">{card.front}</div>
      case 'Glossary': {
        const parts = (card.front || '').split('\n')
        return (
          <div className="text-center space-y-2">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{parts[0]}</div>
            {parts[1] && <div className="text-base font-medium text-purple-600 dark:text-purple-400">{parts[1]}</div>}
          </div>
        )
      }
      case 'Ready Versions':
        return <div className="text-left text-lg leading-relaxed text-gray-800 dark:text-gray-200">{card.front}</div>
      case 'Daily Words':
      default:
        return <div className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">{card.front}</div>
    }
  }

  const renderCardBack = () => {
    if (!card) return null

    switch (card.type) {
      case 'Useful Expressions':
        return <div className="text-center text-xl text-gray-700 dark:text-gray-300 font-medium">{card.back}</div>
      case 'Glossary': {
        const parts = (card.back || '').split('\n')
        return (
          <div className="text-center space-y-3 w-full max-w-xl mx-auto">
            {parts[0] && <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{parts[0]}</div>}
            {parts[1] && <div className="text-sm italic text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-black/20 p-3 rounded-xl">{parts[1]}</div>}
          </div>
        )
      }
      case 'Ready Versions': {
        const sentences = (card.back || '').split('\n').filter(Boolean)
        return (
          <div className="space-y-3 text-left w-full">
            {sentences.map((sentence: string, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-purple-500 font-bold">•</span>
                <span>{sentence}</span>
              </div>
            ))}
          </div>
        )
      }
      case 'Daily Words':
      default:
        return <div className="text-center text-2xl font-bold text-gray-800 dark:text-gray-200">{card.back}</div>
    }
  }

  if (!cardId) return null

  return (
    <Modal isOpen={!!cardId} onClose={onClose} size="lg" className="min-h-[500px]">
      
      {/* Header */}
      <ModalHeader onClose={onClose} showCloseButton={false}>
        <div className="flex items-center justify-between w-full">
          
          {/* Left: Type / Label or Delete confirmation */}
          <div className="flex items-center gap-2">
            {!showDeleteConfirm ? (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete Card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {card && (
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {card.type}
                    </span>
                    {card.type === 'Useful Expressions' && card.style ? (
                      <span className="text-gray-400 font-normal">• {card.style}</span>
                    ) : card.type === 'Glossary' && card.label ? (
                      <div className="flex items-center gap-1">
                        {card.label.split(',').map((l: string) => (
                          <TaxonomyTagBadge key={l} label={l.trim()} size="xs" />
                        ))}
                      </div>
                    ) : card.label && card.label !== 'Vocabulary' ? (
                      <span className="text-gray-400 font-normal">• {card.label}</span>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 px-2.5 py-1 rounded-xl border border-red-200 dark:border-red-900/60 animate-in fade-in">
                <span className="text-xs text-red-600 dark:text-red-400 font-bold">Delete this card?</span>
                <button
                  onClick={handleDeleteCard}
                  className="p-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-xs font-bold"
                  title="Confirm Delete"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="p-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition-colors text-xs"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Edit & Close */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsEditingMode(!isEditingMode)}
              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-semibold ${
                isEditingMode
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={`Edit Card (${getShortcutDisplay('revision.edit')})`}
            >
              <Edit2 className="w-4 h-4" />
              <span>{isEditingMode ? 'Editing' : 'Edit'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={`Close (${getShortcutDisplay('modal.close') || 'Esc'})`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>
      </ModalHeader>

      {/* Body */}
      <ModalBody>
        {isLoading ? (
          <div className="py-20 flex items-center justify-center text-gray-400 text-sm animate-pulse">
            Loading card details...
          </div>
        ) : card ? (
          isEditingMode ? (
            <div className="h-full">
              <CardEditForm
                card={card}
                onCancel={() => setIsEditingMode(false)}
                onSave={handleSaveEdit}
              />
            </div>
          ) : (
            <div className="flex flex-col space-y-6 py-4">
              
              {/* Front Side */}
              <div className="py-8 px-4 flex items-center justify-center min-h-[120px] bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-gray-800/80">
                {renderCardFront()}
              </div>

              {/* Back Side */}
              <div className="py-6 px-4 flex items-center justify-center min-h-[100px] bg-purple-50/20 dark:bg-purple-950/10 rounded-2xl border border-purple-100/50 dark:border-purple-900/30">
                {renderCardBack()}
              </div>

              {/* Card Meta & Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800/80 text-xs text-gray-400">
                <div className="flex items-center gap-3">
                  <span>{(card.repetitions || 0) + (card.manualReviewCount || 0)} Reviews</span>
                  <span>•</span>
                  <span>{card.useCount || 0} Uses</span>
                </div>

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
                      className="px-4 py-1.5 bg-gray-900 hover:bg-black dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold shadow-xs transition-all"
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
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                    >
                      +1 Review Count
                    </button>
                  )}
                </div>
              </div>

              {/* Similar / Synonyms Section */}
              <div className="pt-2">
                {synonyms.length > 0 ? (
                  <div className="p-3 bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-800/40 rounded-xl">
                    <div className="text-[11px] font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Similar / Synonyms Cards:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {synonyms.map(syn => (
                        <button
                          key={syn.id}
                          onClick={() => window.dispatchEvent(new CustomEvent('preview-card', { detail: syn.id }))}
                          className="px-2.5 py-1 bg-white dark:bg-[#1f2028] text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold border border-yellow-200 dark:border-yellow-800 hover:border-purple-400 transition-all shadow-xs"
                          title={syn.back}
                        >
                          {syn.front}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleFindSynonyms}
                    disabled={isSearchingSynonyms}
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSearchingSynonyms ? 'Searching similar cards...' : 'Explore Synonyms / Related Cards'}</span>
                  </button>
                )}
              </div>

            </div>
          )
        ) : (
          <div className="py-20 text-center text-gray-400 text-sm">Card not found</div>
        )}
      </ModalBody>
    </Modal>
  )
}
