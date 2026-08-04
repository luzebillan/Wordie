import React, { useEffect, useState } from 'react'

interface Stats {
  cardsReviewed: number
  retentionRate: number
  cardsToReview: number
}

interface SidebarProps {
  currentView: string
  onNavigate: (view: string, props?: any) => void
  onOpenSettings: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onOpenSettings }) => {
  const [stats, setStats] = useState<Stats>({ cardsReviewed: 0, retentionRate: 0, cardsToReview: 0 })
  const [sketchUntil, setSketchUntil] = useState<string | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      setIsSearching(true)
      window.ipcRenderer.searchCards(searchQuery).then(results => {
        setSearchResults(results)
        setIsSearching(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const fetchStats = () => {
      window.ipcRenderer.getStats().then(setStats)
    }
    fetchStats()

    window.ipcRenderer.getSettings().then(settings => {
      if (settings.sketchEngineValidUntil) {
        setSketchUntil(settings.sketchEngineValidUntil)
      }
    })

    window.addEventListener('stats-updated', fetchStats)
    return () => window.removeEventListener('stats-updated', fetchStats)
  }, [])

  const navItems = [
    { id: 'new-cards', label: 'New Cards', icon: '📝' },
    { id: 'revision', label: 'Revision', icon: '🧠' },
    { id: 'practice', label: 'Practice', icon: '✍️' },
  ]

  return (
    <div className="w-72 shrink-0 h-full bg-white/50 dark:bg-black/20 border-r border-gray-200 dark:border-gray-800 flex flex-col pt-12 pb-6 px-5 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
          C
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 truncate">
          CardsApp
        </span>
      </div>

      {/* Nav Tabs */}
      <nav className="space-y-1 mb-8">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
              currentView === item.id
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Sketch Engine Status */}
      <div className="mb-8 px-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sketch Engine</h3>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {sketchUntil ? `Until ${sketchUntil}` : 'Not Configured'}
        </p>
      </div>

      {/* Today's Stats */}
      <div className="mb-8 px-2 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Today</h3>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Cards Reviewed</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{stats.cardsReviewed}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Retention Rate</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{stats.retentionRate}%</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Cards To Review</span>
          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{stats.cardsToReview}</span>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Settings Row */}
      <div className="mb-4">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <span className="text-base">⚙️</span>
          Settings
        </button>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative z-50">
        <div className="relative w-full flex items-center">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => { if (searchQuery) setShowResults(true) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                setShowResults(false)
                onNavigate('search', searchQuery.trim())
              }
            }}
            placeholder="Search..."
            className="w-full pl-9 pr-8 py-2 bg-gray-100 dark:bg-black/40 border border-transparent focus:border-purple-500 rounded-lg text-sm outline-none transition-all dark:text-gray-200"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery.trim() && (
            <button 
              onClick={() => {
                setShowResults(false)
                onNavigate('search', searchQuery.trim())
              }}
              className="absolute right-2 top-2 p-0.5 text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </div>
        {/* Results Dropdown */}
        {showResults && searchQuery.trim() && (
          <div className="absolute bottom-full mb-2 left-0 w-full md:w-80 max-h-60 overflow-y-auto bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 rounded-xl shadow-[0_4px_20px_0_rgba(0,0,0,0.1)] flex flex-col z-50 animate-in fade-in zoom-in-95 duration-200">
            {isSearching ? (
              <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
            ) : searchResults.length > 0 ? (
              <div className="py-2">
                {searchResults.map(card => (
                  <button 
                    key={card.id} 
                    onClick={() => {
                      setShowResults(false)
                      onNavigate('revision', card.id)
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{card.front}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{card.back}</div>
                    <div className="text-[10px] mt-1 inline-block px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded uppercase tracking-wider">{card.type}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">No results found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
