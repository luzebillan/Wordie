import React from 'react'

interface SidebarProps {
  currentView: string
  onNavigate: (view: string) => void
  onOpenSettings: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onOpenSettings }) => {
  const navItems = [
    { id: 'new-cards', label: 'New Cards', icon: '📝' },
    { id: 'revision', label: 'Revision', icon: '🧠' },
    { id: 'practice', label: 'Practice', icon: '✍️' },
  ]

  return (
    <div className="w-64 h-full bg-white/50 dark:bg-black/20 border-r border-gray-200 dark:border-gray-800 flex flex-col pt-8 pb-6 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
          C
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300">
          CardsApp
        </span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
              currentView === item.id
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
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
