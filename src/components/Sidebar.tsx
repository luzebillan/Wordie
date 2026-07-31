import React, { useEffect, useState } from 'react'

interface Stats {
  cardsReviewed: number
  retentionRate: number
  cardsToReview: number
}

interface SidebarProps {
  currentView: string
  onNavigate: (view: string) => void
  onOpenSettings: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onOpenSettings }) => {
  const [stats, setStats] = useState<Stats>({ cardsReviewed: 0, retentionRate: 0, cardsToReview: 0 })
  const [sketchUntil, setSketchUntil] = useState<string | null>(null)

  useEffect(() => {
    window.ipcRenderer.getStats().then(setStats)
    window.ipcRenderer.getSettings().then(settings => {
      if (settings.sketchEngineValidUntil) {
        setSketchUntil(settings.sketchEngineValidUntil)
      }
    })
  }, [])

  const navItems = [
    { id: 'new-cards', label: 'New Cards', icon: '📝' },
    { id: 'revision', label: 'Revision', icon: '🧠' },
    { id: 'practice', label: 'Practice', icon: '✍️' },
  ]

  return (
    <div className="w-72 h-full bg-white/50 dark:bg-black/20 border-r border-gray-200 dark:border-gray-800 flex flex-col pt-12 pb-6 px-5 backdrop-blur-md overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
          C
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300">
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
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Sketch Engine Status */}
      <div className="mb-8 px-2">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sketch Engine</h3>
          <button onClick={onOpenSettings} className="text-gray-400 hover:text-purple-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
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

      {/* Search */}
      <div className="mt-4">
        <div className="relative w-full">
          <input 
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-black/40 border border-transparent focus:border-purple-500 rounded-lg text-sm outline-none transition-all dark:text-gray-200"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
