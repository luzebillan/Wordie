import React, { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { SettingsModal } from '../components/SettingsModal'
import { UsefulExpressions } from '../components/NewCards/UsefulExpressions'
import { Glossary } from '../components/NewCards/Glossary'
import { DailyWords } from '../components/NewCards/DailyWords'
import { ReadyVersions } from '../components/NewCards/ReadyVersions'
import { Revision } from './Revision'
import { Practice } from './Practice'
import { SearchResults } from './SearchResults'
import { CardPreviewModal } from '../components/CardPreviewModal'

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState('new-cards')
  const [viewProps, setViewProps] = useState<any>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [newCardsTab, setNewCardsTab] = useState('Useful Expressions')
  const [stats, setStats] = useState({ cardsReviewed: 0, cardsToReview: 0 })
  const [previewCardId, setPreviewCardId] = useState<number | null>(null)
  const [previewContext, setPreviewContext] = useState<'practice' | 'default'>('default')
  const [revisionCardId, setRevisionCardId] = useState<number | undefined>(undefined)

  const fetchStats = async () => {
    try {
      const data = await window.ipcRenderer.getStatsByType(newCardsTab)
      setStats(data)
    } catch (err) {
      console.error(err)
    }
  }

  React.useEffect(() => {
    if (currentView === 'new-cards') {
      fetchStats()
    }
    const handleStatsUpdated = () => {
      if (currentView === 'new-cards') {
        fetchStats()
      }
    }
    window.addEventListener('stats-updated', handleStatsUpdated)
    return () => window.removeEventListener('stats-updated', handleStatsUpdated)
  }, [newCardsTab, currentView])

  const handleNavigate = (view: string, props?: any) => {
    setCurrentView(view)
    setViewProps(props)
    if (view === 'revision') {
      setRevisionCardId(props)
    }
  }



  React.useEffect(() => {
    const handlePreview = (e: any) => {
      if (typeof e.detail === 'object' && e.detail !== null) {
        setPreviewCardId(e.detail.id)
        setPreviewContext(e.detail.context || 'default')
      } else {
        setPreviewCardId(e.detail)
        setPreviewContext('default')
      }
    }
    window.addEventListener('preview-card', handlePreview)
    return () => window.removeEventListener('preview-card', handlePreview)
  }, [])

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-[#111216] overflow-hidden text-left">
      {/* Sidebar with Stats and Nav */}
      <Sidebar 
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative bg-white dark:bg-[#16171d]">
        <div className="flex-1 pt-12 pb-8 pl-8 pr-6 overflow-hidden flex flex-col relative">
          
          {/* Keep new-cards alive in the DOM to preserve form state */}
          <div style={{ display: currentView === 'new-cards' ? 'flex' : 'none' }} className="flex-col h-full space-y-4 w-full">
            
            {/* Progress Bar - Spans Full Width at the Top */}
            <div className="mb-2">
              <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  Reviewed {stats.cardsReviewed}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                  To Review {stats.cardsToReview}
                </span>
              </div>
              <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-800 flex">
                {stats.cardsReviewed + stats.cardsToReview > 0 ? (
                  <div 
                    className="bg-gray-400 dark:bg-gray-500 h-full transition-all duration-500" 
                    style={{ width: `${(stats.cardsReviewed / (stats.cardsReviewed + stats.cardsToReview)) * 100}%` }}
                  />
                ) : (
                  <div className="bg-gray-400 dark:bg-gray-500 h-full w-0" />
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 pb-2">
              {['Useful Expressions', 'Glossary', 'Daily Words', 'Ready Versions'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setNewCardsTab(tab)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    newCardsTab === tab 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#1f2028]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Sub Content */}
            <div className="flex-1 overflow-y-auto pr-2">
              <div style={{ display: newCardsTab === 'Useful Expressions' ? 'block' : 'none', height: '100%' }}>
                <UsefulExpressions onNavigate={handleNavigate} onUpdateStats={fetchStats} />
              </div>
              <div style={{ display: newCardsTab === 'Glossary' ? 'block' : 'none', height: '100%' }}>
                <Glossary onNavigate={handleNavigate} />
              </div>
              <div style={{ display: newCardsTab === 'Daily Words' ? 'block' : 'none', height: '100%' }}>
                <DailyWords onNavigate={handleNavigate} />
              </div>
              <div style={{ display: newCardsTab === 'Ready Versions' ? 'block' : 'none', height: '100%' }}>
                <ReadyVersions onNavigate={handleNavigate} />
              </div>
            </div>
          </div>

          <div style={{ display: currentView === 'revision' ? 'block' : 'none', height: '100%', width: '100%' }}>
            <Revision specificCardId={revisionCardId} isActive={currentView === 'revision'} />
          </div>
          {currentView === 'practice' && <Practice />}
          {currentView === 'search' && <SearchResults query={viewProps} onNavigate={handleNavigate} />}
          
          {currentView !== 'new-cards' && currentView !== 'revision' && currentView !== 'practice' && currentView !== 'search' && (
            <div className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl border border-white/40 dark:border-white/10 p-8 min-h-[400px] flex items-center justify-center text-gray-400">
              <p>Content for {currentView} goes here.</p>
            </div>
          )}
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <CardPreviewModal 
        cardId={previewCardId} 
        context={previewContext}
        onClose={() => setPreviewCardId(null)} 
      />
    </div>
  )
}
