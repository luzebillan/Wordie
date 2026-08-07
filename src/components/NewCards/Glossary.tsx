import { useState, useEffect } from 'react'
import { FuzzyMatchList } from './FuzzyMatchList'

interface GlossaryProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

const DOMAINS = [
  'Science',
  'Technology and Engineering',
  'Politics',
  'Economics and Finance',
  'Sociology',
  'Psychology',
  'Liberal Arts',
  'Entertainment'
]

export const Glossary: React.FC<GlossaryProps> = ({ onNavigate, onUpdateStats }) => {
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS[0])
  const [field, setField] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    if (front.trim().length > 1 || back.trim().length > 1) {
      const timer = setTimeout(() => {
        window.ipcRenderer.searchCards(front.trim(), back.trim(), 'Glossary').then(setSimilarCards)
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
      const res = await window.ipcRenderer.generateGlossary(labels, front)
      if (res.success && res.result) {
        try {
          const parsed = JSON.parse(res.result)
          setFront(parsed.front)
          setBack(parsed.back)
        } catch {
          // Fallback if somehow it's not the exact JSON structure string we returned
          setBack(res.result)
        }
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
        sourceContext: '',
        label: labels.join(', ')
      })
      
      setFront('')
      setBack('')
      setLabels([])
      setField('')
      setError('')
      setSimilarCards([])
      if (onUpdateStats) onUpdateStats()
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleIncrementManualReviewCount = async (id: number) => {
    try {
      await window.ipcRenderer.incrementManualReviewCount(id)
      const updated = await window.ipcRenderer.searchCards(front.trim(), back.trim(), 'Glossary')
      setSimilarCards(updated)
      if (onUpdateStats) onUpdateStats()
      
      setToastMessage('+1 Added successfully!')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleAddLabel = () => {
    const newLabel = field.trim() ? `${selectedDomain}\\${field.trim()}` : selectedDomain
    if (!labels.includes(newLabel)) {
      setLabels([...labels, newLabel])
    }
    setField('')
  }

  return (
    <div className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        {/* Domain and Field */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Domain / Field</label>
          <div className="flex gap-2 mb-3">
            <select
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              className="w-1/2 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            >
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input
              type="text"
              value={field}
              onChange={e => setField(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLabel()}
              className="w-1/2 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
              placeholder="Custom Field (Optional)"
            />
            <button
              onClick={handleAddLabel}
              className="px-6 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-2xl font-bold transition-colors"
            >
              Add
            </button>
          </div>
          
          {/* Labels Tags */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {labels.map(label => (
                <span key={label} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                  {label}
                  <button onClick={() => setLabels(labels.filter(l => l !== label))} className="hover:text-purple-900 dark:hover:text-purple-100">
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
              </svg>
              {isGenerating ? 'Generating...' : 'Back Side'}
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
      <FuzzyMatchList 
        similarCards={similarCards}
        emptyMessage="No Similar Terms Found"
        onIncrement={handleIncrementManualReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}
