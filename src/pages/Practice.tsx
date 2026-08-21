import React, { useState, useEffect } from 'react'
import { NewCardModal } from '../components/NewCardModal'
import { useShortcuts } from '../hooks/useShortcuts'

export const Practice: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pure_listener' | 'rewrite' | 'ai_version'>('pure_listener')
  const [practiceCount, setPracticeCount] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Load practice usage count from settings
    window.ipcRenderer.getSettings().then(settings => {
      setPracticeCount(parseInt(settings.practiceUsageCount || '0', 10))
    })
  }, [])

  const handlePracticeComplete = () => {
    const newCount = practiceCount + 1
    setPracticeCount(newCount)
    window.ipcRenderer.saveSettings({ practiceUsageCount: newCount.toString() })
  }

  // Calculate target based on current count (50, 100, 150...)
  const target = Math.ceil((practiceCount + 1) / 50) * 50
  const progressPercent = (practiceCount / target) * 100

  return (
    <div className="h-full flex flex-col pt-8 animate-in fade-in duration-500">
      {/* Top Achievement Bar */}
      <div className="mb-6 px-2">
        <div className="flex justify-between items-end mb-2">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-widest flex items-center gap-2">
            Practice Achievement
          </h2>
          <div className="text-[11px] font-bold text-gray-400">
            You have practiced your expressions in {practiceCount} / {target} texts
          </div>
        </div>
        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gray-400 dark:bg-gray-500 transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 mb-6">
        <button
          onClick={() => setActiveTab('pure_listener')}
          className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${
            activeTab === 'pure_listener' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Pure Listener
          {activeTab === 'pure_listener' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900 dark:bg-white rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('rewrite')}
          className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${
            activeTab === 'rewrite' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Rewrite
          {activeTab === 'rewrite' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900 dark:bg-white rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('ai_version')}
          className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${
            activeTab === 'ai_version' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          AI Version
          {activeTab === 'ai_version' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900 dark:bg-white rounded-t-full" />
          )}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {activeTab === 'pure_listener' && <PureListener onComplete={handlePracticeComplete} />}
        {activeTab === 'rewrite' && <RewritePractice onComplete={handlePracticeComplete} />}
        {activeTab === 'ai_version' && <AiVersion onComplete={handlePracticeComplete} onOpenNewCard={() => setIsModalOpen(true)} />}
      </div>

      <NewCardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}

// -----------------------------------------------------------------------------
// Sub-components for Tabs
// -----------------------------------------------------------------------------

const PureListener: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')

  const handleAnalyze = async () => {
    if (!inputText.trim()) return
    setIsGenerating(true)
    setFeedback('')
    try {
      const res = await window.ipcRenderer.invoke('practice-pure-listener', inputText)
      if (res.success) {
        setFeedback(res.result)
        onComplete()
      } else {
        setFeedback('Error: ' + res.error)
      }
    } catch (e: any) {
      setFeedback('Error: ' + String(e))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex-1 flex gap-6 min-h-0">
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1b23] rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 font-medium text-sm text-gray-500">My Version</div>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type your version here"
          className="flex-1 p-6 bg-transparent resize-none outline-none text-gray-700 dark:text-gray-300"
        />
        <div className="p-4 border-t border-gray-100 dark:border-gray-800/60 flex justify-start gap-2 bg-gray-50/50 dark:bg-black/20">
          <button 
            onClick={handleAnalyze}
            disabled={isGenerating || !inputText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-bold shadow-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
            Pure Listener
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-inner">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 font-medium text-sm text-gray-500">Feedback from a Pure Listener</div>
        <div className="flex-1 p-6 overflow-y-auto">
          {isGenerating ? (
            <div className="h-full flex items-center justify-center text-gray-400 animate-pulse">Analyzing logic and main idea...</div>
          ) : feedback ? (
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{feedback}</div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">Pure Listener Feedback</div>
          )}
        </div>
      </div>
    </div>
  )
}

const RewritePractice: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultText, setResultText] = useState('')
  const [highlightedCards, setHighlightedCards] = useState<any[]>([])

  const handleRewrite = async () => {
    if (!inputText.trim()) return
    setIsGenerating(true)
    setResultText('')
    setHighlightedCards([])
    
    try {
      const res = await window.ipcRenderer.invoke('practice-rewrite', inputText)
      if (res.success) {
        setResultText(res.result.text)
        setHighlightedCards(res.result.cards)
        onComplete()
      } else {
        setResultText('Error: ' + res.error)
      }
    } catch (e: any) {
      setResultText('Error: ' + String(e))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleWordClick = (card: any, e: React.MouseEvent) => {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('preview-card', { detail: { id: card.id, context: 'practice' } }))
  }

  // Render highlighted text
  const renderHighlighted = () => {
    if (!resultText) return null
    if (highlightedCards.length === 0) return resultText

    // Sort by length desc to match longest phrases first
    const sortedWords = [...highlightedCards].sort((a, b) => (b.front || '').length - (a.front || '').length)
    const escapedWords = sortedWords.map(c => (c.front || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    
    const regex = new RegExp(`(\\b${escapedWords.join('|')}\\b)`, 'gi')
    const parts = resultText.split(regex)

    return parts.map((part, i) => {
      const matchedCard = sortedWords.find(c => (c.front || '').toLowerCase() === part.toLowerCase())
      if (matchedCard) {
        return (
          <button
            key={i}
            onClick={(e) => handleWordClick(matchedCard, e)}
            className="px-1 py-0.5 mx-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded font-medium hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors cursor-pointer"
          >
            {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex-1 flex gap-6 min-h-0 relative">
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1b23] rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 font-medium text-sm text-gray-500">My Version</div>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type your version here"
          className="flex-1 p-6 bg-transparent resize-none outline-none text-gray-700 dark:text-gray-300"
        />
        <div className="p-4 border-t border-gray-100 dark:border-gray-800/60 flex justify-start gap-2 bg-gray-50/50 dark:bg-black/20">
          <button 
            onClick={handleRewrite}
            disabled={isGenerating || !inputText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-bold shadow-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
            Rewrite
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-inner">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 font-medium text-sm text-gray-500">Revision</div>
        <div className="flex-1 p-6 overflow-y-auto leading-relaxed">
          {isGenerating ? (
            <div className="h-full flex items-center justify-center text-gray-400 animate-pulse">Extracting & Integrating Vocabulary...</div>
          ) : resultText ? (
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {renderHighlighted()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">
              Rewrite: Using Learned Phrases
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const AiVersion: React.FC<{ onComplete: () => void, onOpenNewCard: () => void }> = ({ onComplete, onOpenNewCard }) => {
  const { isActionPressed } = useShortcuts()
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultText, setResultText] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('card.new', e)) {
        e.preventDefault()
        onOpenNewCard()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenNewCard, isActionPressed])

  const handleGenerate = async () => {
    if (!inputText.trim()) return
    setIsGenerating(true)
    setResultText('')
    try {
      const res = await window.ipcRenderer.invoke('practice-ai-version', inputText)
      if (res.success) {
        setResultText(res.result)
        onComplete()
      } else {
        setResultText('Error: ' + res.error)
      }
    } catch (e: any) {
      setResultText('Error: ' + String(e))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex-1 flex gap-6 min-h-0 relative">
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1b23] rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 font-medium text-sm text-gray-500">My Version</div>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type your version here"
          className="flex-1 p-6 bg-transparent resize-none outline-none text-gray-700 dark:text-gray-300"
        />
        <div className="p-4 border-t border-gray-100 dark:border-gray-800/60 flex justify-start gap-2 bg-gray-50/50 dark:bg-black/20">
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !inputText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-bold shadow-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
            AI Version
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden shadow-inner relative">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 font-medium text-sm text-gray-500">AI Version</div>
        <div className="flex-1 p-6 overflow-y-auto leading-relaxed">
          {isGenerating ? (
            <div className="h-full flex items-center justify-center text-gray-400 animate-pulse">Generating an elite interpretation...</div>
          ) : resultText ? (
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {resultText}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">
              New Version: Fresh Expressions
            </div>
          )}
        </div>
        
        {/* Issue 04: New Cards Button */}
        <div className="absolute bottom-4 right-4">
          <button 
            onClick={onOpenNewCard}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-bold shadow-lg hover:scale-105 transition-transform"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="12" x2="12" y1="8" y2="16"></line><line x1="8" x2="16" y1="12" y2="12"></line></svg>
            New Cards (Ctrl+N)
          </button>
        </div>
      </div>
    </div>
  )
}
