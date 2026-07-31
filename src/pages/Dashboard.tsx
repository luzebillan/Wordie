import React, { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { SettingsModal } from '../components/SettingsModal'

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState('new-cards')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-[#111216] overflow-hidden text-left pt-8">
      {/* Sidebar with Stats and Nav */}
      <Sidebar 
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white capitalize m-0">
            {currentView.replace('-', ' ')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your vocabulary and track your learning progress.
          </p>
        </header>

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
