import React, { useEffect, useState, useMemo } from 'react'
import {
  Search,
  RotateCcw,
  Trash2,
  CheckSquare,
  Square,
  X
} from 'lucide-react'
import {
  type CardFilterState,
  DEFAULT_FILTER_STATE,
  filterAndSortCards,
  computeStatusCounts
} from '../utils/searchFilter'
import { AdvancedFilterBar } from '../components/AdvancedFilterBar'
import { TaxonomyTagBadge } from '../components/TaxonomyTagBadge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

interface SearchResultsProps {
  query: string
  onNavigate: (view: string, props?: any) => void
}

export const SearchResults: React.FC<SearchResultsProps> = ({ query, onNavigate }) => {
  const [cards, setCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<CardFilterState>({
    ...DEFAULT_FILTER_STATE,
    query: query || ''
  })

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [cardsToDelete, setCardsToDelete] = useState<number[]>([])

  const fetchSearchResults = async (q: string) => {
    setIsLoading(true)
    try {
      const data = await window.ipcRenderer.searchCards(q)
      setCards(data || [])
    } catch (err) {
      console.error('Failed to execute search:', err)
      setCards([])
    } finally {
      setIsLoading(false)
    }
  }

  // Update query when prop changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, query: query || '' }))
    fetchSearchResults(query || '')
  }, [query])

  // Sync on deletion and updates
  useEffect(() => {
    const handleCardDeleted = (e: any) => {
      const deletedCardId = e.detail
      setCards(prev => prev.filter(card => card.id !== deletedCardId))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(deletedCardId)
        return next
      })
    }
    const handleCardUpdated = () => {
      fetchSearchResults(filters.query)
    }
    window.addEventListener('card-deleted', handleCardDeleted)
    window.addEventListener('stats-updated', handleCardUpdated)
    return () => {
      window.removeEventListener('card-deleted', handleCardDeleted)
      window.removeEventListener('stats-updated', handleCardUpdated)
    }
  }, [filters.query])

  const availableLabels = useMemo(() => {
    const labels = new Set<string>()
    for (const card of cards) {
      if (card.label) {
        card.label.split(',').forEach((l: string) => {
          const trimmed = l.trim()
          if (trimmed) labels.add(trimmed)
        })
      }
    }
    return Array.from(labels).sort()
  }, [cards])

  const statusCounts = useMemo(() => {
    return computeStatusCounts(cards)
  }, [cards])

  const filteredCards = useMemo(() => {
    return filterAndSortCards(cards, filters)
  }, [cards, filters])

  const toggleSelection = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCards.length && filteredCards.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCards.map(c => c.id)))
    }
  }

  const handleDeleteConfirm = async () => {
    if (cardsToDelete.length === 0) return
    try {
      const result = await window.ipcRenderer.deleteCards(cardsToDelete)
      if (result.success) {
        setCards(prev => prev.filter(card => !cardsToDelete.includes(card.id)))
        setSelectedIds(prev => {
          const next = new Set(prev)
          cardsToDelete.forEach(id => next.delete(id))
          return next
        })
        window.dispatchEvent(new Event('stats-updated'))
      }
    } catch (error) {
      console.error('Failed to delete cards:', error)
    } finally {
      setCardsToDelete([])
    }
  }

  const handleBulkReset = async () => {
    if (selectedIds.size === 0) return
    try {
      const ids = Array.from(selectedIds)
      await window.ipcRenderer.resetCardsProgress(ids)
      setSelectedIds(new Set())
      window.dispatchEvent(new Event('stats-updated'))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      {/* Header Title */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Search & Discovery</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Found {cards.length} cards matching query · {filteredCards.length} matching filters
            </p>
          </div>
        </div>

        {filteredCards.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-sm"
          >
            {selectedIds.size > 0 && selectedIds.size === filteredCards.length ? (
              <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
            <span>{selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select All'}</span>
          </button>
        )}
      </div>

      {/* Advanced Filter Bar with Quick Chips */}
      <AdvancedFilterBar
        filters={filters}
        onFilterChange={setFilters}
        statusCounts={statusCounts}
        availableLabels={availableLabels}
        filteredCount={filteredCards.length}
      />

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/50 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedIds(new Set())} className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">{selectedIds.size} card{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleBulkReset}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-yellow-600 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Reset Progress
            </button>
            <button 
              onClick={() => setCardsToDelete(Array.from(selectedIds))}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto pr-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCards.map(card => (
              <div 
                key={card.id} 
                onClick={() => {
                  if (selectedIds.size > 0) {
                    toggleSelection(card.id)
                  } else {
                    window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id }))
                  }
                }}
                className={`bg-white dark:bg-[#1f2028] p-5 rounded-2xl border ${selectedIds.has(card.id) ? 'border-purple-500 shadow-md ring-1 ring-purple-500' : 'border-gray-200 dark:border-gray-800 shadow-sm'} hover:shadow-md cursor-pointer transition-all hover:border-purple-300 dark:hover:border-purple-700/50 group flex flex-col justify-between relative`}
              >
                {/* Checkbox indicator */}
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleSelection(card.id); }}
                  className={`absolute top-3 left-3 p-1 rounded-lg z-10 transition-opacity ${selectedIds.has(card.id) ? 'opacity-100 text-purple-500' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-purple-400'}`}
                >
                  {selectedIds.has(card.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>

                <div>
                  <div className="flex justify-between items-start mb-2 gap-4 pl-7">
                    <div className="text-base font-bold text-gray-900 dark:text-gray-100 line-clamp-2 break-words">{card.front}</div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <div className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded uppercase tracking-wider font-bold shrink-0">
                        {card.type}
                      </div>
                      {card.type === 'Useful Expressions' && (
                        <div className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-semibold uppercase tracking-wider">
                          {card.style || 'General'}
                        </div>
                      )}
                      {card.type === 'Glossary' && card.label && (
                        <TaxonomyTagBadge label={card.label} size="xs" />
                      )}
                      {card.type === 'Ready Versions' && card.label && (
                        <div className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-semibold uppercase tracking-wider">
                          {card.label}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 break-words">{card.back}</div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-400">
                  <div className="flex gap-3">
                    <span>R: {card.repetitions || 0}</span>
                    <span>I: {card.interval || 0}d</span>
                    {(card.lapses || 0) > 0 && <span className="text-red-500 font-semibold">Lapses: {card.lapses}</span>}
                  </div>
                  {card.imageUrl && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                      Image
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-10 bg-white/50 dark:bg-[#1f2028]/50 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed p-12">
            <Search className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="font-medium text-gray-600 dark:text-gray-400">No cards found matching your criteria.</p>
            {filters !== DEFAULT_FILTER_STATE && (
              <button
                onClick={() => setFilters(DEFAULT_FILTER_STATE)}
                className="mt-3 text-sm text-purple-600 dark:text-purple-400 font-bold hover:underline"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cardsToDelete.length > 0}
        title={cardsToDelete.length > 1 ? `Delete ${cardsToDelete.length} Cards?` : 'Delete Card?'}
        message={`This action cannot be undone. Are you sure you want to permanently delete ${cardsToDelete.length > 1 ? 'these cards' : 'this card'}?`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setCardsToDelete([])}
      />
    </div>
  )
}
