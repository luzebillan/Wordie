import { useState, useEffect } from 'react'

interface GlossaryProps {
  onNavigate?: (view: string, props?: any) => void;
}

export const Glossary: React.FC<GlossaryProps> = ({ onNavigate }) => {
  const [domain, setDomain] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    if (front.trim().length > 1 || back.trim().length > 1) {
      const timer = setTimeout(() => {
        window.ipcRenderer.searchCards(front.trim(), back.trim()).then(setSimilarCards)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSimilarCards([])
    }
  }, [front, back])

  const handleGenerate = async () => {
    if (!front.trim()) {
      setError('Please enter a target term first.')
      return
    }
    setError('')
    setIsGenerating(true)
    
    try {
      const res = await window.ipcRenderer.generateGlossary(domain, front)
      if (res.success && res.result) {
        setBack(res.result)
      } else {
        setError(res.error || 'Failed to generate glossary explanation.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!front || !back) {
      setError('Both Term and Explanation are required.')
      return
    }
    
    try {
      await window.ipcRenderer.createCard({
        type: 'Glossary',
        front,
        back,
        sourceContext: domain,
        label: ''
      })
      
      setDomain('')
      setFront('')
      setBack('')
      setError('')
      setSimilarCards([])
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleIncrementEncounterCount = async (id: number) => {
    try {
      await window.ipcRenderer.incrementEncounterCount(id)
      const updated = await window.ipcRenderer.searchCards(front.trim(), back.trim())
      setSimilarCards(updated)
      
      setToastMessage('Encounter +1, schedule unchanged')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err: any) {
      console.error(err)
    }
  }

  return (
    <div className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        {/* Domain */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Domain / Field</label>
          <input
            type="text"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="e.g. IT, Medical, Business"
          />
        </div>

        {/* Front Side */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Target Term (Front Side)</label>
          <input
            type="text"
            value={front}
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Type the Term Here"
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
              {isGenerating ? 'Generating...' : 'Explanation (Back Side)'}
            </button>
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>
          
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            disabled={isGenerating}
            className={`w-full h-48 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm ${isGenerating ? 'opacity-50' : ''}`}
            placeholder="AI will generate the bilingual definition here..."
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={!front || !back || isGenerating}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Term
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
            <p className="text-lg font-medium">No Similar Terms Found</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Similar Cards</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {similarCards.map((card) => (
                <div 
                  key={card.id} 
                  className="bg-white dark:bg-[#1f2028] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
                  onClick={() => onNavigate && onNavigate('revision', card.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-purple-600 dark:text-purple-400">{card.front}</h4>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500">
                      Encounters: {card.encounterCount || 0}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                    {card.back}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIncrementEncounterCount(card.id);
                    }}
                    className="w-full py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    +1 Encounter
                  </button>
                </div>
              ))}
            </div>
            {toastMessage && (
              <div className="mt-4 p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold rounded-lg text-center animate-in slide-in-from-bottom-2 fade-in">
                {toastMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
