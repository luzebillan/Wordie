import React, { useState } from 'react'
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
  SlidersHorizontal
} from 'lucide-react'
import {
  type CardFilterState,
  type StatusCounts,
  DEFAULT_FILTER_STATE,
  parseSearchSyntax
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

  // Calculate number of active non-default filters (excluding query)
  const activeFilterCount = [
    filters.type !== 'All',
    filters.status !== 'all',
    filters.label !== 'All',
    filters.style !== 'All',
    filters.hasImage !== 'all',
    filters.timeRange !== 'all',
    filters.sortBy !== 'relevance'
  ].filter(Boolean).length

  const handleQueryChange = (text: string) => {
    const { cleanQuery, parsedFilters } = parseSearchSyntax(text)
    onFilterChange({
      ...filters,
      ...parsedFilters,
      query: cleanQuery
    })
  }

  const handleResetFilters = () => {
    onFilterChange({
      ...DEFAULT_FILTER_STATE,
      query: filters.query // Keep text query when resetting dropdowns
    })
  }

  const setStatus = (status: CardFilterState['status']) => {
    onFilterChange({
      ...filters,
      status: filters.status === status ? 'all' : status
    })
  }

  const toggleImageOnly = () => {
    onFilterChange({
      ...filters,
      hasImage: filters.hasImage === 'with_image' ? 'all' : 'with_image'
    })
  }

  return (
    <div className="flex flex-col gap-3 mb-6 bg-white dark:bg-[#1f2028] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300">
      {/* 1. Main Search Bar & Primary Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => handleQueryChange(e.target.value)}
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
          onClick={() => onFilterChange({ ...filters, status: 'all', hasImage: 'all' })}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
            filters.status === 'all' && filters.hasImage === 'all'
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
            filters.status === 'due'
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
            filters.status === 'leech'
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
            filters.status === 'new'
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
            filters.hasImage === 'with_image'
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
              value={filters.type}
              onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
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
              value={filters.status}
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value as any })}
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
              value={filters.label}
              onChange={(e) => onFilterChange({ ...filters, label: e.target.value })}
              className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-medium dark:text-gray-200 outline-none focus:border-purple-500"
            >
              <option value="All">All Labels</option>
              {availableLabels.map(lbl => (
                <option key={lbl} value={lbl}>{lbl}</option>
              ))}
            </select>
          </div>

          {/* Style */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Style</label>
            <select
              value={filters.style}
              onChange={(e) => onFilterChange({ ...filters, style: e.target.value })}
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
              value={filters.timeRange}
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
              value={filters.sortBy}
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
