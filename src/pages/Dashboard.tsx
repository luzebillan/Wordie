import React, { useState, useEffect } from 'react'
import { Sidebar } from '../components/Sidebar'
import { SettingsModal } from '../components/SettingsModal'
import { UsefulExpressions } from '../components/NewCards/UsefulExpressions'
import { Glossary } from '../components/NewCards/Glossary'
import { DailyWords } from '../components/NewCards/DailyWords'
import { ReadyVersions } from '../components/NewCards/ReadyVersions'
import { Revision } from './Revision'
import { Practice } from './Practice'
import { SearchResults } from './SearchResults'

const ModuleProgress: React.FC<{ moduleName: string }> = ({ moduleName }) => {
  const [progress, setProgress] = useState({ total: 0, due: 0, reviewed: 0 })

  useEffect(() => {
    const fetchProgress = async () => {
      const data = await window.ipcRenderer.getModuleProgress(moduleName)
      setProgress(data)
    }
    fetchProgress()
    
    // Refresh every few seconds to keep it updated when cards are added/reviewed
    const interval = setInterval(fetchProgress, 2000)
    return () => clearInterval(interval)
  }, [moduleName])

  const percentage = progress.total === 0 ? 0 : Math.round((progress.reviewed / progress.total) * 100)

  return (
    <div className="flex flex-col gap-4 sticky top-0">
      <h3 className="font-bold text-gray-900 dark:text-white mb-2">{moduleName} Progress</h3>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Reviewed</span>
        <span className="font-bold text-green-600 dark:text-green-400">{progress.reviewed}</span>
      </div>
      
      <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-green-500 dark:bg-green-400 transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      
      <div className="flex justify-between text-sm mt-1">
        <span className="text-gray-500">To Review</span>
        <span className="font-bold text-gray-700 dark:text-gray-300">{progress.due}</span>
      </div>
      
      <div className="flex justify-between text-sm mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <span className="text-gray-500">Total Cards</span>
        <span className="font-bold text-gray-900 dark:text-gray-100">{progress.total}</span>
      </div>
    </div>
  )
}

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState('new-cards')
  const [viewProps, setViewProps] = useState<any>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [newCardsTab, setNewCardsTab] = useState('Useful Expressions')

  const handleNavigate = (view: string, props?: any) => {
    setCurrentView(view)
    setViewProps(props)
  }

  const renderContent = () => {
    if (currentView === 'new-cards') {
      return (
        <div className="h-full flex gap-8">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Sub Navigation */}
            <div className="flex gap-8 border-b border-gray-200 dark:border-gray-800 mb-8 pb-3">
              {['Useful Expressions', 'Glossary', 'Daily Words', 'Ready Versions'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setNewCardsTab(tab)}
                  className={`text-lg font-bold transition-colors relative whitespace-nowrap ${
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
            <div className="flex-1 overflow-y-auto pr-2">
              {newCardsTab === 'Useful Expressions' && <UsefulExpressions />}
              {newCardsTab === 'Glossary' && <Glossary />}
              {newCardsTab === 'Daily Words' && <DailyWords />}
              {newCardsTab === 'Ready Versions' && <ReadyVersions />}
            </div>
          </div>
          
          {/* Module Progress Sidebar */}
          <div className="w-56 shrink-0 border-l border-gray-200 dark:border-gray-800 pl-8 hidden lg:block">
            <ModuleProgress moduleName={newCardsTab} />
          </div>
        </div>
      )
    }

    if (currentView === 'revision') {
      return <Revision specificCardId={viewProps} />
    }

    if (currentView === 'practice') {
      return <Practice />
    }
    
    if (currentView === 'search') {
      return <SearchResults query={viewProps} onNavigate={handleNavigate} />
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
        onNavigate={handleNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative bg-white dark:bg-[#16171d] rounded-tl-2xl shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] border-t border-l border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-8 pb-4">
          {renderContent()}
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}
