import React, { useState } from 'react'

export const Practice: React.FC = () => {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultText, setResultText] = useState('')
  const [targetCards, setTargetCards] = useState<any[]>([])
  const [error, setError] = useState('')
  
  // Tooltip state
  const [activeCard, setActiveCard] = useState<any | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleRewrite = async () => {
    if (!inputText.trim()) {
      setError('Please write something first.')
      return
    }
    if (inputText.length < 20) {
      setError('Please write at least a few sentences (20+ characters).')
      return
    }

    setError('')
    setIsGenerating(true)
    setResultText('')
    setActiveCard(null)

    try {
      // 1. Fetch 8 random cards
      const randomCards = await window.ipcRenderer.getRandomCards(8)
      if (!randomCards || randomCards.length === 0) {
        throw new Error('Your database is empty. Add some cards first!')
      }
      setTargetCards(randomCards)
      
      const targetWords = randomCards.map(c => c.front)
      
      // 2. Ask AI to rewrite
      const res = await window.ipcRenderer.aiRewritePractice(inputText, targetWords)
      
      if (res.success && res.result) {
        setResultText(res.result)
      } else {
        throw new Error(res.error || 'Failed to rewrite text.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleWordClick = async (card: any, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 })
    setActiveCard(card)
    
    // Increment use count in DB
    try {
      await window.ipcRenderer.incrementUseCount(card.id)
    } catch (e) {
      console.error('Failed to increment use count', e)
    }
  }

  // Parse resultText and replace matching target words with buttons
  const renderHighlightedText = () => {
    if (!resultText) return null

    // We create a regex to match any of the target words.
    // Sort by length descending to match longest phrases first.
    const sortedWords = [...targetCards].sort((a, b) => (b.front || '').length - (a.front || '').length)
    const escapedWords = sortedWords.map(c => (c.front || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    
    if (escapedWords.length === 0) return resultText

    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi')
    const parts = resultText.split(regex)

    return parts.map((part, i) => {
      // Check if this part is one of the target words (case-insensitive)
      const matchedCard = sortedWords.find(c => (c.front || '').toLowerCase() === part.toLowerCase())
      
      if (matchedCard) {
        return (
          <button
            key={i}
            onClick={(e) => handleWordClick(matchedCard, e)}
            className="px-1.5 py-0.5 mx-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md font-bold hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors cursor-pointer relative"
          >
            {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="h-full flex flex-col pt-8 animate-in fade-in duration-500 relative">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Practice Module</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Write a draft, and let AI rewrite it while embedding random words from your vocabulary. Click highlighted words to review them!
        </p>
      </div>

      <div className="flex-1 flex gap-8">
        {/* Left: Input */}
        <div className="flex-1 flex flex-col">
          <label className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Your Draft</label>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            className="flex-1 p-6 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-3xl resize-none outline-none focus:ring-2 focus:ring-purple-500 text-lg shadow-sm"
            placeholder="Write a paragraph about your day, a specific topic, or anything you want to practice..."
          />
          {error && <div className="text-red-500 text-sm font-bold mt-2">{error}</div>}
          
          <button
            onClick={handleRewrite}
            disabled={isGenerating}
            className="mt-6 py-4 px-8 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-xl shadow-gray-900/20 dark:shadow-white/10 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <span className="animate-pulse">Rewriting & Embedding...</span>
            ) : (
              <>
                <span>✨</span> Rewrite & Upgrade
              </>
            )}
          </button>
        </div>

        {/* Right: Output */}
        <div className="flex-1 flex flex-col">
          <label className="text-sm font-bold text-purple-500 uppercase tracking-widest mb-3 flex justify-between">
            <span>AI Rewritten</span>
            {targetCards.length > 0 && <span>Attempted to embed {targetCards.length} words</span>}
          </label>
          <div className="flex-1 p-8 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-y-auto text-lg leading-loose shadow-sm">
            {isGenerating ? (
              <div className="flex h-full items-center justify-center text-gray-400 animate-pulse">
                Consulting the AI editor...
              </div>
            ) : resultText ? (
              <div className="whitespace-pre-wrap">
                {renderHighlightedText()}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400 italic">
                Your upgraded text will appear here.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {activeCard && (
        <>
          {/* Invisible backdrop to close tooltip */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setActiveCard(null)}
          />
          <div 
            className="fixed z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-6 rounded-2xl shadow-2xl max-w-sm animate-in zoom-in-95 duration-200 pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1 tracking-widest uppercase">
              {activeCard.type}
            </div>
            <div className="text-xl font-bold mb-3">{activeCard.front}</div>
            <div className="text-base opacity-90">{activeCard.back}</div>
            
            {/* Tooltip triangle */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 dark:bg-white rotate-45" />
          </div>
        </>
      )}
    </div>
  )
}
