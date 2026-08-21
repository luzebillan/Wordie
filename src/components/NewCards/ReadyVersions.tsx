import { useState, useEffect, useRef } from 'react'
import { Save } from 'lucide-react'
import { FuzzyMatchList } from './FuzzyMatchList'
import { useSimilarCards } from '../../hooks/useSimilarCards'
import { useShortcuts } from '../../hooks/useShortcuts'

interface ReadyVersionsProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

const TYPES = ['Noun Phrase', 'Verb Phrase', 'Adjective Phrase', 'Sentence']

export const ReadyVersions: React.FC<ReadyVersionsProps> = ({ onNavigate, onUpdateStats }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const containerRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState(TYPES[0])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState('')

  const {
    mode,
    similarCards,
    isSearching,
    isAnalyzing,
    toastMessage,
    setSearchQuery,
    handleIncrementReviewCount,
    reset
  } = useSimilarCards({ cardType: 'Ready Versions' })

  const handleSave = async () => {
    if (!front || !back) {
      setError('Both Phrase and Translation are required.')
      return
    }
    
    try {
      await window.ipcRenderer.createCard({
        type: 'Ready Versions',
        front,
        back,
        label
      })
      
      setFront('')
      setBack('')
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
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [front, back, label, isActionPressed])

  return (
    <div ref={containerRef} className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        {/* Type Options */}
        <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-3">Type</label>
          <div className="flex flex-col gap-3">
            {TYPES.map(t => (
              <label key={t} className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={label === t}
                  onChange={() => setLabel(t)}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 monochrome:accent-gray-900 monochrome:text-gray-900 monochrome:focus:ring-gray-900 bg-white" 
                />
                <span className="text-gray-800 dark:text-gray-200 font-medium">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Front Side */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Front Side</label>
          <input
            type="text"
            value={front}
            onChange={e => {
              const val = e.target.value
              setFront(val)
              setSearchQuery(val)
            }}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Enter Chinese"
          />
        </div>

        {/* Back Side */}
        <div className="mb-6 relative">
          <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Back Side</label>
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <input
            type="text"
            value={back}
            onChange={e => setBack(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Enter English"
          />
        </div>

        {/* Save */}
        <div className="flex justify-start pb-8">
          <button
            onClick={handleSave}
            disabled={!front || !back}
            className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save
            <span className="text-xs opacity-75 font-normal ml-0.5">({getShortcutDisplay('card.submit')})</span>
          </button>
        </div>
      </div>

      {/* Right Panel: Duplicate Checker & Matching Versions */}
      <FuzzyMatchList 
        similarCards={similarCards}
        mode={mode}
        isSearching={isSearching}
        isAnalyzing={isAnalyzing}
        emptyMessage={front.trim() ? "No Matching Versions Found" : "Start typing to search existing versions..."}
        onIncrement={handleIncrementReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}
