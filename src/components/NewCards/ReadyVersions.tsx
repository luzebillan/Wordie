import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { FuzzyMatchList } from './FuzzyMatchList'

interface ReadyVersionsProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

const TYPES = ['Noun Phrase', 'Verb Phrase', 'Adjective Phrase', 'Sentence']

export const ReadyVersions: React.FC<ReadyVersionsProps> = ({ onNavigate, onUpdateStats }) => {
  const [label, setLabel] = useState(TYPES[0])
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState('')

  // Debounced search for similar cards removed by user request

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
      setSimilarCards([])
      if (onUpdateStats) onUpdateStats()
      window.dispatchEvent(new Event('stats-updated'))
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Card saved successfully!' } }))
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleIncrementManualReviewCount = async (id: number) => {
    try {
      await window.ipcRenderer.incrementManualReviewCount(id)
      const updated = await window.ipcRenderer.findSimilarCards(front.trim(), back.trim())
      setSimilarCards(updated)
      if (onUpdateStats) onUpdateStats()
      
      setToastMessage('+1 Added successfully!')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err: any) {
      console.error(err)
    }
  }

  return (
    <div className="flex h-full animate-in fade-in duration-500">
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
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Type the Front Side of Your New Card Here"
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
            placeholder="Type the Back Side of Your New Card Here"
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
          </button>
        </div>
      </div>

      {/* Right Panel: Duplicate Checker */}
      <FuzzyMatchList 
        similarCards={similarCards}
        emptyMessage="No Similar Versions Found"
        onIncrement={handleIncrementManualReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}
