import React, { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { SettingsModal } from '../components/SettingsModal'

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState('new-cards')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleMin = () => window.ipcRenderer.windowMin()
  const handleMax = () => window.ipcRenderer.windowMax()
  const handleClose = () => window.ipcRenderer.windowClose()

  return (
    <div className="flex h-screen bg-white dark:bg-[#111216] overflow-hidden w-full text-left">
      <Sidebar 
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Custom Titlebar Controls Area */}
        <div className="h-12 w-full titlebar-drag flex justify-end items-center px-4">
          <div className="flex gap-2 titlebar-nodrag">
            <button onClick={handleMin} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
            </button>
            <button onClick={handleMax} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500 hover:text-white text-gray-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <main className="flex-1 px-10 pb-10 overflow-y-auto custom-scrollbar">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white capitalize tracking-tight m-0">
              {currentView.replace('-', ' ')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
              Manage your vocabulary and track your learning progress.
            </p>
          </header>

          {/* View Content Placeholder */}
          <div className="bg-gray-50 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800/60 p-10 min-h-[500px] flex items-center justify-center text-gray-400">
            <p className="text-lg">Content for <strong className="text-purple-400">{currentView}</strong> goes here.</p>
          </div>
        </main>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}
