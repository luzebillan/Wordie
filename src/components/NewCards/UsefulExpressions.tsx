import { useState, useEffect } from 'react'

export function UsefulExpressions() {
  const [context, setContext] = useState('')
  const [front, setFront] = useState('')
  const [style, setStyle] = useState('General')
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])

  // Debounced search for similar cards
  useEffect(() => {
    if (front.trim().length > 1) {
      const timer = setTimeout(() => {
        window.ipcRenderer.searchCards(front.trim()).then(setSimilarCards)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSimilarCards([])
    }
  }, [front])

  const handleGenerate = async () => {
    if (!front.trim()) {
      setError('Please enter a target expression first.')
      return
    }
    setError('')
    setIsGenerating(true)
    
    try {
      const res = await window.ipcRenderer.generateExpression(context, style, front)
      if (res.success && res.result) {
        setBack(res.result)
      } else {
        setError(res.error || 'Failed to generate explanation.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!front || !back) {
      setError('Both Front and Back sides are required.')
      return
    }
    
    try {
      await window.ipcRenderer.createCard({
        type: 'Useful Expressions',
        front,
        back,
        style,
        label: ''
      })
      
      // Reset form on success
      setContext('')
      setFront('')
      setBack('')
      setStyle('General')
      setError('')
      setSimilarCards([])
      // You could show a success toast here
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleIncrementUseCount = async (id: number) => {
    try {
      await window.ipcRenderer.incrementUseCount(id)
      // Refresh similar cards to show updated count (optional, but good for feedback)
      const updated = await window.ipcRenderer.searchCards(front.trim())
      setSimilarCards(updated)
    } catch (err: any) {
      console.error(err)
    }
  }

  return (
    <div className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pr-8 overflow-y-auto">
        {/* Context */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Context</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            className="w-full h-32 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Type Your Context Here"
          />
        </div>

        {/* Style selection */}
        <div className="flex gap-6 mb-8">
          {['Informal', 'Formal', 'General'].map(s => (
            <label key={s} className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                style === s 
                  ? 'bg-purple-500 border-purple-500' 
                  : 'border-gray-300 dark:border-gray-600 bg-transparent group-hover:border-purple-400'
              }`}>
                {style === s && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-sm font-medium ${style === s ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>
                {s}
              </span>
            </label>
          ))}
        </div>

        {/* Front Side */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Front Side</label>
          <input
            type="text"
            value={front}
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Type the Front Side of Your New Card Here"
          />
        </div>

        {/* Generate Button & Back Side */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !front}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 dark:bg-gray-100 hover:bg-black dark:hover:bg-white text-white dark:text-gray-900 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <span>✨</span>
              {isGenerating ? 'Generating...' : 'Back Side'}
            </button>
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>
          
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            disabled={isGenerating}
            className={`w-full h-48 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm ${isGenerating ? 'opacity-50' : ''}`}
            placeholder="AI will generate the explanation here..."
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={!front || !back || isGenerating}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Card
          </button>
        </div>
      </div>

      {/* Right Panel: Duplicate Checker */}
      <div className="w-80 bg-gray-100/50 dark:bg-[#16171d] rounded-2xl p-6 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800">
        {similarCards.length === 0 ? (
          <div className="text-center opacity-50 flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <p className="text-lg font-medium">No Similar Expressions Found</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Similar Cards</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {similarCards.map((card) => (
                <div key={card.id} className="bg-white dark:bg-[#1f2028] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-purple-600 dark:text-purple-400">{card.front}</h4>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500">
                      Used: {card.useCount}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                    {card.back}
                  </p>
                  <button
                    onClick={() => handleIncrementUseCount(card.id)}
                    className="w-full py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    +1 Use Count
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
