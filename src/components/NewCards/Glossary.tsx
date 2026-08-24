import { useState, useEffect, useRef } from 'react'
import { Save, Eraser } from 'lucide-react'
import { FuzzyMatchList } from './FuzzyMatchList'
import { useSimilarCards } from '../../hooks/useSimilarCards'
import { useShortcuts } from '../../hooks/useShortcuts'
import { GlossaryTaxonomySelector } from '../GlossaryTaxonomySelector'

interface GlossaryProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

export const Glossary: React.FC<GlossaryProps> = ({ onNavigate, onUpdateStats }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [labels, setLabels] = useState<string[]>([])
  const [front, setFront] = useState('')
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
  } = useSimilarCards({ cardType: 'Glossary' })

  const handleGenerate = async () => {
    if (!front.trim()) {
      setError('Please enter a target term first.')
      return
    }
    setError('')
    setIsGenerating(true)
    
    try {
      const res = await window.ipcRenderer.generateGlossary(labels, front)
      if (res.success && res.result) {
        let finalFront = front
        let finalBack = res.result
        try {
          const parsed = JSON.parse(res.result)
          setFront(parsed.front)
          setBack(parsed.back)
          finalFront = parsed.front
          finalBack = parsed.back
        } catch {
          // Fallback if somehow it's not the exact JSON structure string we returned
          setBack(res.result)
        }
        await triggerSemanticSearch(finalFront, finalBack, 'Glossary')
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
    
    if (labels.length === 0) {
      setError('Please select at least one field.')
      return
    }
    
    try {
      await window.ipcRenderer.createCard({
        type: 'Glossary',
        front,
        back,
        sourceContext: '',
        label: labels.join(', ')
      })
      
      setFront('')
      setBack('')
      setLabels([])
      setError('')
      reset()
      
      if (onUpdateStats) onUpdateStats()
      window.dispatchEvent(new Event('stats-updated'))
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Card saved successfully!' } }))
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleClear = () => {
    if (isGenerating) return
    setFront('')
    setBack('')
    setLabels([])
    setError('')
    reset()
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
      } else if (isActionPressed('card.clear', e)) {
        e.preventDefault()
        handleClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [front, back, labels, isGenerating, isActionPressed])

  return (
    <div ref={containerRef} className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        {/* Domain and Field Selector */}
        <div className="mb-6">
          <GlossaryTaxonomySelector
            selectedTags={labels}
            onChange={setLabels}
          />
        </div>

        {/* Front Side */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Term</label>
          <textarea
            value={front}
            onChange={e => {
              const val = e.target.value
              setFront(val)
              setSearchQuery(val)
            }}
            className="w-full p-4 h-24 resize-none bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Enter Term (Chinese or English)"
          />
        </div>

        {/* Generate Button & Back Side */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !front || labels.length === 0}
              title={labels.length === 0 ? "Select at least one field" : ""}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 monochrome:bg-gray-800 monochrome:hover:bg-black dark:monochrome:bg-gray-100 dark:monochrome:hover:bg-white text-white dark:monochrome:text-gray-900 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
              </svg>
              {isGenerating ? 'Generating...' : 'Create Glossary'}
              {!back.trim() && <span className="text-xs opacity-75 font-normal ml-0.5">({getShortcutDisplay('card.submit')})</span>}
            </button>
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>
          
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            disabled={isGenerating}
            className={`w-full h-56 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm ${isGenerating ? 'opacity-50' : ''}`}
            placeholder="AI Bilingual Explanation (Editable)"
          />
        </div>

        <div className="flex items-center gap-3 justify-start pb-8">
          <button
            onClick={handleSave}
            disabled={!front || !back || isGenerating || labels.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save
            {back.trim() && <span className="text-xs opacity-75 font-normal ml-0.5">({getShortcutDisplay('card.submit')})</span>}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isGenerating || (!front && !back && labels.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Clear form (${getShortcutDisplay('card.clear')})`}
          >
            <Eraser className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Right Panel: Duplicate Checker & Similar Terms */}
      <FuzzyMatchList 
        similarCards={similarCards}
        mode={mode}
        isSearching={isSearching}
        isAnalyzing={isAnalyzing}
        emptyMessage={front.trim() ? "No Matching Terms Found" : "Start typing to search existing terms..."}
        onIncrement={handleIncrementReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}
