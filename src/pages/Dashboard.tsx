import React, { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { SettingsModal } from '../components/SettingsModal'
import { UsefulExpressions } from '../components/NewCards/UsefulExpressions'
import { Glossary } from '../components/NewCards/Glossary'
import { DailyWords } from '../components/NewCards/DailyWords'
import { ReadyVersions } from '../components/NewCards/ReadyVersions'
import { Revision } from './Revision'
import { Practice } from './Practice'

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState('new-cards')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [newCardsTab, setNewCardsTab] = useState('Useful Expressions')

  const renderContent = () => {
    if (currentView === 'new-cards') {
      return (
        <div className="h-full flex flex-col">
          {/* Sub Navigation */}
          <div className="flex gap-8 border-b border-gray-200 dark:border-gray-800 mb-8 pb-3">
            {['Useful Expressions', 'Glossary', 'Daily Words', 'Ready Versions'].map(tab => (
              <button
                key={tab}
                onClick={() => setNewCardsTab(tab)}
                className={`text-lg font-bold transition-colors relative ${
                  newCardsTab === tab 
                    ? 'text-gray-900 dark:text-white' 
                    : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
                }`}
              >
                {tab}
                {newCardsTab === tab && (
                  <div className="absolute -bottom-[14px] left-0 w-full h-1 bg-gray-900 dark:bg-white rounded-t-full"></div>
                )}
              </button>
            ))}
          </div>

          {/* Sub Content */}
          <div className="flex-1 overflow-hidden">
            {newCardsTab === 'Useful Expressions' && <UsefulExpressions />}
            {newCardsTab === 'Glossary' && <Glossary />}
            {newCardsTab === 'Daily Words' && <DailyWords />}
            {newCardsTab === 'Ready Versions' && <ReadyVersions />}
          </div>
        </div>
      )
    }

    if (currentView === 'revision') {
      return <Revision />
    }

    if (currentView === 'practice') {
      return <Practice />
    }

    return (
      <div className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10 p-8 min-h-[400px] flex items-center justify-center text-gray-400">
        <p>Content for {currentView} goes here.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-[#111216] overflow-hidden text-left pt-8">
      {/* Sidebar with Stats and Nav */}
      <Sidebar 
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-hidden flex flex-col">
        {renderContent()}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}
