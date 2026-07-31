import React, { useEffect, useState } from 'react'

interface SidebarProps {
  currentView: string
  onNavigate: (view: string) => void
  onOpenSettings: () => void
}

interface Stats {
  cardsReviewed: number
  retentionRate: number
  cardsToReview: number
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onOpenSettings }) => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [validUntil, setValidUntil] = useState<string | null>(null)

  useEffect(() => {
    window.ipcRenderer.getStats().then(setStats)
    window.ipcRenderer.getSettings().then(s => {
      setValidUntil(s.sketchEngineValidUntil || null)
    })
  }, [])

  const navItems = [
    { id: 'new-cards', label: 'New Cards', icon: '📝' },
    { id: 'revision', label: 'Revision', icon: '🧠' },
    { id: 'practice', label: 'Practice', icon: '✍️' },
  ]

  return (
    <div className="w-80 h-full bg-white/60 dark:bg-[#1f2028]/90 border-r border-gray-200 dark:border-gray-800 flex flex-col pt-8 pb-6 px-5 backdrop-blur-xl titlebar-drag">
      
      {/* App Header */}
      <div className="flex items-center gap-3 mb-8 px-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-md">
          C
        </div>
        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300">
          CardsApp
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 titlebar-nodrag pr-2 custom-scrollbar">
        
        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                currentView === item.id
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Global Search */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">Search</h3>
          <div className="relative">
            <input 
              type="text"
              placeholder="Search all cards..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm shadow-sm dark:text-gray-200"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3.5 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Today's Stats */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">Today</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800/50">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cards Reviewed</span>
              <span className="font-semibold text-gray-900 dark:text-gray-200">{stats?.cardsReviewed || 0}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800/50">
              <span className="text-sm text-gray-600 dark:text-gray-400">Retention Rate</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{stats?.retentionRate || 0}%</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800/50">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cards To Review</span>
              <span className="font-semibold text-orange-500 dark:text-orange-400">{stats?.cardsToReview || 0}</span>
            </div>
          </div>
        </div>

        {/* API Status */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-1">API Status</h3>
          <div className="px-4 py-3 bg-white dark:bg-black/20 rounded-xl border border-gray-100 dark:border-gray-800/50 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${validUntil ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Sketch Engine</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 pl-4">
              {validUntil ? `Until ${validUntil}` : 'Not connected'}
            </p>
          </div>
        </div>

      </div>

      {/* Settings Footer */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 titlebar-nodrag mt-4">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <span className="text-lg">⚙️</span>
          Settings
        </button>
      </div>
    </div>
  )
}
