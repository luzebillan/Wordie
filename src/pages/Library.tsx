import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Trash2, Library as LibraryIcon, MoreHorizontal, Edit3, RotateCcw, Grid, List, CheckSquare, Square, X } from 'lucide-react'
import {
  type CardFilterState,
  DEFAULT_FILTER_STATE,
  filterAndSortCards,
  computeStatusCounts
} from '../utils/searchFilter'
import { AdvancedFilterBar } from '../components/AdvancedFilterBar'
import { TaxonomyTagBadge } from '../components/TaxonomyTagBadge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

interface LibraryProps {
  onNavigate?: (view: string, props?: any) => void
}

export const Library: React.FC<LibraryProps> = ({ onNavigate }) => {
  const [cards, setCards] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<CardFilterState>(DEFAULT_FILTER_STATE)
  
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('wordie_library_view_mode') as 'grid' | 'table') || 'table'
  })
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  
  const [cardsToDelete, setCardsToDelete] = useState<number[]>([])
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, card: any } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleViewModeChange = (mode: 'grid' | 'table') => {
    setViewMode(mode)
    localStorage.setItem('wordie_library_view_mode', mode)
  }

  const fetchCards = async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    const savedScrollTop = scrollContainerRef.current?.scrollTop
    try {
      const data = await window.ipcRenderer.getCards()
      setCards(data || [])
    } catch (error) {
      console.error('Failed to fetch cards:', error)
    } finally {
      if (showLoading) setIsLoading(false)
      if (savedScrollTop !== undefined && scrollContainerRef.current) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollTop
          }
        })
      }
    }
  }

  useEffect(() => {
    fetchCards(true)
    
    const handleCardDeleted = (e: any) => {
      const deletedCardId = e.detail
      setCards(prev => prev.filter(card => card.id !== deletedCardId))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(deletedCardId)
        return next
      })
    }

    const handleCardUpdated = (e: any) => {
      const updatedCard = e.detail
      if (!updatedCard || !updatedCard.id) return
      setCards(prev => prev.map(card => card.id === updatedCard.id ? { ...card, ...updatedCard } : card))
    }

    const handleStatsUpdated = () => {
      fetchCards(false)
    }

    window.addEventListener('card-deleted', handleCardDeleted)
    window.addEventListener('card-updated', handleCardUpdated)
    window.addEventListener('stats-updated', handleStatsUpdated)
    
    return () => {
      window.removeEventListener('card-deleted', handleCardDeleted)
      window.removeEventListener('card-updated', handleCardUpdated)
      window.removeEventListener('stats-updated', handleStatsUpdated)
    }
  }, [])

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
      fetchCards()
    } catch (e) {
      console.error(e)
    }
  }

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

  const handleContextMenu = (e: React.MouseEvent, card: any) => {
    e.preventDefault()
    let x = e.clientX
    let y = e.clientY
    const menuWidth = 200
    const menuHeight = 240
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
    
    setContextMenu({ x, y, card })
  }

  const handleMenuClick = (e: React.MouseEvent, card: any) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    let x = rect.right
    let y = rect.bottom
    const menuWidth = 200
    const menuHeight = 240
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
    
    setContextMenu({ x, y, card })
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
            <LibraryIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Card Library</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total {cards.length} cards · {filteredCards.length} matching filters
            </p>
          </div>
        </div>

        <div className="flex items-center bg-gray-50 dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl p-1 shadow-sm">
          <button 
            onClick={() => handleViewModeChange('table')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleViewModeChange('grid')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-800 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            title="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advanced Filter & Search Bar */}
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

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredCards.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCards.map(card => (
                <div 
                  key={card.id} 
                  className={`group relative bg-white dark:bg-[#1f2028] p-5 rounded-2xl border ${selectedIds.has(card.id) ? 'border-purple-500 shadow-md' : 'border-gray-200 dark:border-gray-800 shadow-sm'} hover:shadow-lg transition-all duration-300 hover:border-purple-300 dark:hover:border-purple-700/50 flex flex-col h-56 cursor-pointer`}
                  onContextMenu={(e) => handleContextMenu(e, card)}
                  onClick={(e) => {
                    if (selectedIds.size > 0) {
                      toggleSelection(card.id)
                    } else {
                      window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id }))
                    }
                  }}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelection(card.id); }}
                    className={`absolute top-3 left-3 p-1 rounded-lg z-10 transition-opacity ${selectedIds.has(card.id) ? 'opacity-100 text-purple-500' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-purple-400'}`}
                  >
                    {selectedIds.has(card.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={(e) => handleMenuClick(e, card)}
                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
                    title="More Options"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  <div className="flex-1 overflow-hidden flex flex-col pt-4">
                    <div className="flex justify-between items-start mb-3 gap-2 pl-6 pr-6">
                      <div className="text-base font-bold text-gray-900 dark:text-gray-100 line-clamp-2 break-words leading-tight">{card.front}</div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-[9px] px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded uppercase tracking-widest font-bold shrink-0">
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
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 break-words flex-1">
                      {card.back}
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-auto border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs font-medium text-gray-400">
                    <div className="flex gap-3">
                      <span title="Repetitions">R: {card.repetitions || 0}</span>
                      <span title="Interval">I: {card.interval || 0}d</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="p-4 w-12 text-center">
                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-purple-500 transition-colors">
                          {selectedIds.size > 0 && selectedIds.size === filteredCards.length ? <CheckSquare className="w-4 h-4 text-purple-500 mx-auto" /> : <Square className="w-4 h-4 mx-auto" />}
                        </button>
                      </th>
                      <th className="p-4 font-semibold w-1/4">Front</th>
                      <th className="p-4 font-semibold w-1/3">Back</th>
                      <th className="p-4 font-semibold">Type</th>
                      <th className="p-4 font-semibold">Stats</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-sm">
                    {filteredCards.map(card => (
                      <tr 
                        key={card.id} 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group cursor-pointer ${selectedIds.has(card.id) ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
                        onClick={() => toggleSelection(card.id)}
                        onContextMenu={(e) => handleContextMenu(e, card)}
                      >
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleSelection(card.id)} className="text-gray-400 hover:text-purple-500 transition-colors">
                            {selectedIds.has(card.id) ? <CheckSquare className="w-4 h-4 text-purple-500 mx-auto" /> : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 mx-auto" />}
                          </button>
                        </td>
                        <td 
                          className="p-4 font-medium text-gray-900 dark:text-gray-100" 
                          onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id })); }}
                        >
                          {card.type === 'Glossary' ? (
                            <div className="space-y-0.5" title={card.front}>
                              {card.front ? (
                                card.front.split('\n').map((line: string, idx: number) => (
                                  <div key={idx} className={idx === 0 ? "font-bold text-gray-900 dark:text-gray-100 text-sm" : "text-xs text-purple-600 dark:text-purple-400 font-medium"}>
                                    {line}
                                  </div>
                                ))
                              ) : null}
                            </div>
                          ) : (
                            <div className="line-clamp-2" title={card.front}>{card.front}</div>
                          )}
                        </td>
                        <td 
                          className="p-4 text-gray-500 dark:text-gray-400" 
                          onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id })); }}
                        >
                          {card.type === 'Glossary' ? (
                            <div className="space-y-1 text-xs" title={card.back}>
                              {card.back ? (
                                card.back.split('\n').map((line: string, idx: number) => (
                                  <div key={idx} className={idx === 0 ? "text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"}>
                                    {line}
                                  </div>
                                ))
                              ) : null}
                            </div>
                          ) : (
                            <div className="line-clamp-2" title={card.back}>{card.back}</div>
                          )}
                        </td>
                        <td className="p-4" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id })); }}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 whitespace-nowrap">
                              {card.type}
                            </span>
                            {card.type === 'Useful Expressions' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                {card.style || 'General'}
                              </span>
                            )}
                            {card.type === 'Glossary' && card.label && (
                              <div className="flex flex-col gap-1 items-start w-full mt-1">
                                {card.label.split(',').map((l: string) => (
                                  <TaxonomyTagBadge key={l} label={l.trim()} size="xs" />
                                ))}
                              </div>
                            )}
                            {card.type === 'Ready Versions' && card.label && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                {card.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-400 text-xs whitespace-nowrap" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id })); }}>
                          R:{card.repetitions || 0} · I:{card.interval || 0}d
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => handleMenuClick(e, card)}
                            className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 opacity-0 group-hover:opacity-100 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-64 bg-white/50 dark:bg-[#1f2028]/50 rounded-3xl border border-gray-200 dark:border-gray-800 border-dashed">
            <LibraryIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No cards found matching your criteria.</p>
            {filters !== DEFAULT_FILTER_STATE && (
              <button 
                onClick={() => setFilters(DEFAULT_FILTER_STATE)}
                className="mt-4 text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline"
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

      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[200] w-48 bg-white dark:bg-[#2a2b36] rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 py-2 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 border-b border-gray-100 dark:border-gray-800">
            Card Actions
          </div>
          
          <button 
            className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-3 transition-colors"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('preview-card', { detail: { id: contextMenu.card.id, editMode: true } }))
              setContextMenu(null)
            }}
          >
            <Edit3 className="w-4 h-4" /> Edit Card
          </button>
          
          <button 
            className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:text-yellow-600 dark:hover:text-yellow-400 flex items-center gap-3 transition-colors"
            onClick={async () => {
              try {
                await window.ipcRenderer.resetCardProgress(contextMenu.card.id)
                fetchCards() // Refresh data
              } catch (e) {
                console.error(e)
              }
              setContextMenu(null)
            }}
          >
            <RotateCcw className="w-4 h-4" /> Reset Progress
          </button>
          
          <div className="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
          
          <button 
            className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3 transition-colors"
            onClick={() => {
              setCardsToDelete([contextMenu.card.id])
              setContextMenu(null)
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
