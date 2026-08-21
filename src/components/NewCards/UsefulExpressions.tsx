import { useState, useEffect, useRef } from 'react'
import { Save } from 'lucide-react'
import { FuzzyMatchList } from './FuzzyMatchList'
import { useSimilarCards } from '../../hooks/useSimilarCards'
import { useShortcuts } from '../../hooks/useShortcuts'

interface UsefulExpressionsProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

export const UsefulExpressions: React.FC<UsefulExpressionsProps> = ({ onNavigate, onUpdateStats }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const containerRef = useRef<HTMLDivElement>(null)
  const [context, setContext] = useState('')
  const [front, setFront] = useState('')
  const [style, setStyle] = useState<string>('General')
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const {
    mode,
    similarCards,
    isSearching,
    isAnalyzing,
    toastMessage,
    setSearchQuery,
    triggerSemanticSearch,
    handleIncrementReviewCount,
    reset
  } = useSimilarCards({ cardType: 'Useful Expressions' })

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
        // Switch to AI semantic & synonym analysis
        await triggerSemanticSearch(front, res.result, 'Useful Expressions', context)
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
        label: '',
        sourceContext: context
      })
      
      // Reset form and similar cards on success
      setContext('')
      setFront('')
      setBack('')
      setStyle('General')
      setError('')
      reset()
      
      if (onUpdateStats) onUpdateStats()
      window.dispatchEvent(new Event('stats-updated'))
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Card saved successfully!' } }))
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current || containerRef.current.offsetParent === null) return
      if (isActionPressed('card.submit', e)) {
        e.preventDefault()
        if (isGenerating) return
        if (!back.trim()) {
          handleGenerate()
        } else {
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [front, back, context, style, isGenerating, isActionPressed])

  return (
    <div ref={containerRef} className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Form */}
        <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">

          {/* Context */}
          <div className="mb-6">
            <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Context</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              className="w-full h-32 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
              placeholder="Enter Context or Sentence"
            />
          </div>

          {/* Style selection */}
          <div className="flex gap-6 mb-8">
            {['Informal', 'Formal', 'General'].map(s => (
              <label key={s} className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={style === s}
                  onChange={() => setStyle(s)}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 monochrome:accent-gray-900 monochrome:text-gray-900 monochrome:focus:ring-gray-900 bg-white" 
                />
                <span className="text-gray-800 dark:text-gray-200 font-medium">{s}</span>
              </label>
            ))}
          </div>

          {/* Front Side */}
          <div className="mb-6">
            <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Front Side</label>
            <input
              type="text"
              value={front}
              onChange={e => {
                const val = e.target.value
                setFront(val)
                setSearchQuery(val)
              }}
              className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
              placeholder="Enter Target Word/Phrase"
            />
          </div>

          {/* Generate Button & Back Side */}
          <div className="mb-6 relative">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !front}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 monochrome:bg-gray-800 monochrome:hover:bg-black dark:monochrome:bg-gray-100 dark:monochrome:hover:bg-white text-white dark:monochrome:text-gray-900 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
                </svg>
                {isGenerating ? 'Generating...' : 'Back Side'}
                {!back.trim() && <span className="text-xs opacity-75 font-normal ml-0.5">(Ctrl+↵)</span>}
              </button>
              {error && <span className="text-red-500 text-sm">{error}</span>}
            </div>
            
            <textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              disabled={isGenerating}
              className={`w-full h-48 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm ${isGenerating ? 'opacity-50' : ''}`}
              placeholder="AI Explanation (Editable)"
            />
          </div>

          <div className="flex justify-start pb-8">
            <button
              onClick={handleSave}
              disabled={!front || !back || isGenerating}
              className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save
              {back.trim() && <span className="text-xs opacity-75 font-normal ml-0.5">({getShortcutDisplay('card.submit')})</span>}
            </button>
          </div>
        </div>

        {/* Right Panel: Duplicate Checker & Similar Cards */}
        <FuzzyMatchList 
          similarCards={similarCards}
          mode={mode}
          isSearching={isSearching}
          isAnalyzing={isAnalyzing}
          emptyMessage={front.trim() ? "No Matching Expressions Found" : "Start typing to search existing expressions..."}
          onIncrement={handleIncrementReviewCount}
          onNavigate={onNavigate}
          toastMessage={toastMessage}
        />
      </div>
    </div>
  )
}
