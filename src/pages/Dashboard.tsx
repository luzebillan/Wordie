import React, { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { StatsDashboard } from '../components/StatsDashboard'
import { SettingsModal } from '../components/SettingsModal'

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState('new-cards')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#111216] overflow-hidden w-full text-left">
      <Sidebar 
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white capitalize m-0">
              {currentView.replace('-', ' ')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage your vocabulary and track your learning progress.
            </p>
          </div>
          
          <div className="relative w-64">
            <input 
              type="text"
              placeholder="Search cards..."
              className="w-full pl-10 pr-4 py-2 bg-white/60 dark:bg-black/30 border border-gray-300 dark:border-gray-700 rounded-full focus:ring-2 focus:ring-purple-500 outline-none backdrop-blur-sm transition-all"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </header>

        <StatsDashboard />

        {/* View Content Placeholder */}
        <div className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10 p-8 min-h-[400px] flex items-center justify-center text-gray-400">
          <p>Content for {currentView} goes here.</p>
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}
