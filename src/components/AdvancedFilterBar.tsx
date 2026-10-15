import React, { useState, useRef, useMemo } from 'react'
import {
  Search,
  Filter,
  X,
  RotateCcw,
  Sparkles,
  Flame,
  Clock,
  BookOpen,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Tag
} from 'lucide-react'
import {
  type CardFilterState,
  type StatusCounts,
  type SearchSyntaxSuggestion,
  DEFAULT_FILTER_STATE,
  getEffectiveFilters,
  removeSyntaxFromQuery,
  getSyntaxSuggestions
} from '../utils/searchFilter'

interface AdvancedFilterBarProps {
  filters: CardFilterState
  onFilterChange: (filters: CardFilterState) => void
  statusCounts: StatusCounts
  availableLabels: string[]
  filteredCount?: number
  placeholder?: string
  cardTypes?: string[]
}

export const AdvancedFilterBar: React.FC<AdvancedFilterBarProps> = ({
  filters,
  onFilterChange,
  statusCounts,
  availableLabels,
  placeholder = 'Search keyword or syntax (e.g. is:due tag:Tech style:Formal)...',
  cardTypes = ['All', 'Useful Expressions', 'Glossary', 'Daily Words', 'Ready Versions']
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)

  const effective = getEffectiveFilters(filters)

  // Compute dynamic suggestions based on what user is typing
  const suggestions = useMemo(() => {
    return getSyntaxSuggestions(filters.query, availableLabels)
  }, [filters.query, availableLabels])

  // Calculate number of active non-default filters (excluding query)
  const activeFilterCount = [
    effective.type !== 'All',
    effective.status !== 'all',
    effective.label !== 'All',
    effective.style !== 'All',
    effective.hasImage !== 'all',
    effective.timeRange !== 'all',
    effective.sortBy !== 'relevance'
  ].filter(Boolean).length

  // Pure pass-through: never destructively rewrite or swallow user keystrokes in onChange!
  const handleQueryChange = (text: string) => {
    onFilterChange({
      ...filters,
      query: text
    })
    setIsSuggestionsOpen(true)
    setSelectedSuggestionIndex(0)
  }

  const handleSelectSuggestion = (suggestion: SearchSyntaxSuggestion) => {
    // Replace the trailing operator token being typed at cursor/end
    const match = filters.query.match(/(?:^|\s)([a-zA-Z0-9_:-]*(?:"[^"]*)?)$/)
    let newQuery = filters.query
    if (match && match[1] !== undefined) {
      const startIndex = filters.query.length - match[1].length
      newQuery = filters.query.slice(0, startIndex) + suggestion.token + ' '
    } else {
      newQuery = filters.query ? `${filters.query.trimEnd()} ${suggestion.token} ` : `${suggestion.token} `
    }
    onFilterChange({ ...filters, query: newQuery })
    setIsSuggestionsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionsOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
        e.preventDefault()
        handleSelectSuggestion(suggestions[selectedSuggestionIndex])
      }
    } else if (e.key === 'Escape') {
      setIsSuggestionsOpen(false)
    }
  }

  const handleResetFilters = () => {
    // Keep user's keyword query intact while removing syntax tokens and resetting dropdowns
    const cleanQuery = removeSyntaxFromQuery(filters.query)
    onFilterChange({
      ...DEFAULT_FILTER_STATE,
      query: cleanQuery
    })
  }

  const setStatus = (status: CardFilterState['status']) => {
    const isCurrentlyActive = effective.status === status
    const nextStatus = isCurrentlyActive ? 'all' : status
    const cleanQuery = removeSyntaxFromQuery(filters.query, ['status'])
    onFilterChange({
      ...filters,
      query: cleanQuery,
      status: nextStatus
    })
  }

  const toggleImageOnly = () => {
    const isCurrentlyActive = effective.hasImage === 'with_image'
    const nextImage = isCurrentlyActive ? 'all' : 'with_image'
    const cleanQuery = removeSyntaxFromQuery(filters.query, ['hasImage'])
    onFilterChange({
      ...filters,
      query: cleanQuery,
      hasImage: nextImage
    })
  }

  return (
    <div className="flex flex-col gap-3 mb-6 bg-white dark:bg-[#1f2028] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300">
      {/* 1. Main Search Bar & Primary Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input with Autocomplete Popover */}
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={filters.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onCompositionStart={() => { isComposingRef.current = true }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false
              handleQueryChange((e.target as HTMLInputElement).value)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setIsSuggestionsOpen(true)
            }}
            onBlur={() => {
              // Delay slightly so click events on suggestion items register
              setTimeout(() => setIsSuggestionsOpen(false), 200)
            }}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl text-sm outline-none transition-all dark:text-gray-200 placeholder:text-gray-400"
          />
          {filters.query && (
            <button
              onClick={() => onFilterChange({ ...filters, query: '' })}
              className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Autocomplete Suggestions Popover */}
          {isSuggestionsOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex justify-between items-center border-b border-gray-100 dark:border-gray-800/60">
                <span>Filter Syntax Suggestions</span>
                <span className="text-[9px] font-normal lowercase">press tab or enter to apply</span>
              </div>
              {suggestions.map((s, idx) => (
                <button
                  key={s.token}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectSuggestion(s)
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors ${
                    idx === selectedSuggestionIndex
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-100/70 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                      {s.token}
                    </span>
                    <span className="text-xs font-medium">{s.label}</span>
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">{s.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setIsDrawerOpen(prev => !prev)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
            isDrawerOpen || activeFilterCount > 0
              ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800/60 dark:text-purple-300 shadow-sm'
              : 'bg-gray-50 dark:bg-[#16171d] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. Quick Filter Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold select-none scrollbar-none">
        {/* All Chip */}
        <button
          onClick={() => {
            const cleanQuery = removeSyntaxFromQuery(filters.query, ['status', 'hasImage'])
            onFilterChange({ ...filters, query: cleanQuery, status: 'all', hasImage: 'all' })
          }}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
            effective.status === 'all' && effective.hasImage === 'all'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
              : 'bg-gray-100 dark:bg-[#16171d] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
          }`}
        >
          <span>All</span>
          <span className="opacity-70 text-[11px]">({statusCounts.total})</span>
        </button>

        {/* Due Today Chip */}
        <button
          onClick={() => setStatus('due')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
            effective.status === 'due'
              ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>Due Today</span>
          <span className="font-bold text-[11px]">({statusCounts.due})</span>
        </button>

        {/* Leeches / Hard Chip */}
        <button
          onClick={() => setStatus('leech')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
            effective.status === 'leech'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60'
          }`}
        >
          <Flame className="w-3 h-3" />
          <span>Leeches / Hard</span>
          <span className="font-bold text-[11px]">({statusCounts.leeches})</span>
        </button>

        {/* New Cards Chip */}
        <button
          onClick={() => setStatus('new')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
            effective.status === 'new'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>New</span>
          <span className="font-bold text-[11px]">({statusCounts.newCards})</span>
        </button>

        {/* Images Chip */}
        <button
          onClick={toggleImageOnly}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
            effective.hasImage === 'with_image'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
          }`}
        >
          <ImageIcon className="w-3 h-3" />
          <span>With Images</span>
          <span className="font-bold text-[11px]">({statusCounts.withImages})</span>
        </button>
      </div>

      {/* 3. Expandable Multi-Dimensional Filter Drawer */}
      {isDrawerOpen && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Card Type */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Type</label>
            <select
              value={effective.type}
              onChange={(e) => {
                const cleanQuery = removeSyntaxFromQuery(filters.query, ['type'])
                onFilterChange({ ...filters, query: cleanQuery, type: e.target.value })
              }}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              {cardTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Memory Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={effective.status}
              onChange={(e) => {
                const cleanQuery = removeSyntaxFromQuery(filters.query, ['status'])
                onFilterChange({ ...filters, query: cleanQuery, status: e.target.value as any })
              }}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="due">Due Today</option>
              <option value="new">New (Unlearned)</option>
              <option value="learning">Learning</option>
              <option value="mature">Mature (21d+)</option>
              <option value="leech">Leech (Lapses ≥ 3)</option>
            </select>
          </div>

          {/* Label / Domain Tag */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tag / Label</label>
            <select
              value={effective.label}
              onChange={(e) => {
                const cleanQuery = removeSyntaxFromQuery(filters.query, ['label'])
                onFilterChange({ ...filters, query: cleanQuery, label: e.target.value })
              }}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              <option value="All">All Labels</option>
              {availableLabels.map(lbl => (
                <option key={lbl} value={lbl}>
                  {lbl.includes('/') ? lbl.replace(/\//g, ' › ') : lbl}
                </option>
              ))}
            </select>
          </div>

          {/* Style */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Style</label>
            <select
              value={effective.style}
              onChange={(e) => {
                const cleanQuery = removeSyntaxFromQuery(filters.query, ['style'])
                onFilterChange({ ...filters, query: cleanQuery, style: e.target.value })
              }}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              <option value="All">All Styles</option>
              <option value="Formal">Formal</option>
              <option value="Informal">Informal</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Added Time</label>
            <select
              value={effective.timeRange}
              onChange={(e) => onFilterChange({ ...filters, timeRange: e.target.value as any })}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Sort By</label>
            <select
              value={effective.sortBy}
              onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value as any })}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              <option value="relevance">Relevance</option>
              <option value="createdAt_desc">Newest Added</option>
              <option value="createdAt_asc">Oldest Added</option>
              <option value="nextReviewDate_asc">Due Earliest</option>
              <option value="lapses_desc">Most Forgotten (Lapses)</option>
              <option value="useCount_desc">Most Practiced</option>
            </select>
          </div>

          {/* Reset Filters Option if any active */}
          {activeFilterCount > 0 && (
            <div className="col-span-full flex justify-end pt-1">
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 font-semibold hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset all dropdown filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
