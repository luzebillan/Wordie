import { useState, useEffect, useRef } from 'react'
import { Save, Eraser } from 'lucide-react'
import { FuzzyMatchList } from './FuzzyMatchList'
import { useSimilarCards } from '../../hooks/useSimilarCards'
import { useShortcuts } from '../../hooks/useShortcuts'

interface DailyWordsProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

export const DailyWords: React.FC<DailyWordsProps> = ({ onNavigate, onUpdateStats }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const containerRef = useRef<HTMLDivElement>(null)
  const [front, setFront] = useState('')
  const [context, setContext] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isCaching, setIsCaching] = useState(false)
  const [back, setBack] = useState('')
  const [candidates, setCandidates] = useState<DailyWordCandidate[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
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
  } = useSimilarCards({ cardType: 'Daily Words' })

  const handleGenerate = async () => {
    if (!front.trim() && !imageUrl.trim()) {
      setError('Please enter a word or upload an image first.')
      return
    }
    setError('')
    setCandidates([])
    setIsGenerating(true)
    
    try {
      const payload = {
        front: front.trim(),
        context: context.trim(),
        picture: imageUrl
      }
      const res = await window.ipcRenderer.generateDailyWord(payload)
      if (res.success && res.result) {
        if (typeof res.result === 'string') {
          setBack(res.result)
          setCandidates([])
          if (!front.trim()) {
            setSearchQuery(res.result)
          }
        } else {
          setBack(res.result.primary)
          setCandidates(res.result.candidates || [])
          if (!front.trim()) {
            setSearchQuery(res.result.primary)
          }
        }
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
    const trimmedFront = front.trim()
    const trimmedBack = back.trim()
    if (!trimmedFront && !imageUrl.trim()) {
      setError('Either a Word or an Image is required.')
      return
    }
    if (!trimmedBack) {
      setError('Translation is required.')
      return
    }
    
    // Check if the image url is an external url that hasn't been cached
    if (imageUrl && imageUrl.startsWith('http')) {
      setError('Please cache the image first before saving.')
      return
    }

    try {
      await window.ipcRenderer.createCard({
        type: 'Daily Words',
        front: trimmedFront || '[Image Only]',
        back: trimmedBack,
        sourceContext: '',
        imageUrl: imageUrl.trim(),
        label: ''
      })
      
      setFront('')
      setContext('')
      setImageUrl('')
      setBack('')
      setCandidates([])
      setError('')
      reset()

      if (onUpdateStats) onUpdateStats()
      window.dispatchEvent(new Event('stats-updated'))
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Card saved successfully!' } }))
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleCacheImage = async () => {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      setError('Please enter a valid HTTP/HTTPS URL.')
      return
    }
    setError('')
    setIsCaching(true)
    try {
      const res = await window.ipcRenderer.downloadImage(imageUrl)
      if (res.success && res.filename) {
        setImageUrl(res.filename)
      } else {
        setError(res.error || 'Failed to download image.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsCaching(false)
    }
  }

  const handleUploadLocal = async () => {
    setError('')
    setIsCaching(true)
    try {
      const res = await window.ipcRenderer.uploadLocalImage()
      if (res.success && res.filename) {
        setImageUrl(res.filename)
      } else if (res.error !== 'User canceled file selection') {
        setError(res.error || 'Failed to upload image.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsCaching(false)
    }
  }

  const handleClear = () => {
    if (isGenerating || isCaching) return
    setFront('')
    setContext('')
    setImageUrl('')
    setBack('')
    setCandidates([])
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
  }, [front, context, imageUrl, back, isGenerating, isCaching, isActionPressed, candidates])

  return (
    <div ref={containerRef} className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        {/* Top Row: Front Side & Context */}
        <div className="mb-4 bg-gray-50/50 dark:bg-[#1f2028]/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <label className="block text-sm font-bold text-gray-900 dark:text-white mb-3">Front Side</label>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={front}
              onChange={e => {
                const val = e.target.value
                setFront(val)
                setSearchQuery(val)
              }}
              className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
              placeholder="Enter Chinese word"
            />
            <span className="font-bold text-gray-500 text-sm whitespace-nowrap">in</span>
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
              className="flex-1 p-3 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
              placeholder="Context"
            />
          </div>
        </div>

        {/* AND / OR divider */}
        <div className="flex items-center justify-center mb-4">
          <span className="text-xs font-bold text-gray-500 tracking-widest">AND / OR</span>
        </div>

        {/* Picture Area */}
        <div className="mb-6 bg-gray-50/50 dark:bg-[#1f2028]/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="flex-1 p-2 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm text-sm"
              placeholder="Paste Image URL"
            />
            {imageUrl && imageUrl.startsWith('http') && (
              <button
                onClick={handleCacheImage}
                disabled={isCaching}
                className="px-3 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
              >
                {isCaching ? '...' : 'Cache'}
              </button>
            )}
            <button
              onClick={handleUploadLocal}
              disabled={isCaching}
              className="px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold transition-colors disabled:opacity-50 text-sm"
              title="Upload Local File"
            >
              📁
            </button>
          </div>
          
          <div className="flex-1 bg-white dark:bg-[#1f2028] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center min-h-[160px] relative overflow-hidden">
            {imageUrl && !imageUrl.startsWith('http') ? (
              <img src={`local-asset://${imageUrl}`} alt="Cached Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
            ) : imageUrl ? (
              <img src={imageUrl} alt="External Preview" className="absolute inset-0 w-full h-full object-contain p-2 opacity-50" />
            ) : (
              <span className="text-gray-400 text-sm font-medium">Photo Preview</span>
            )}
          </div>
        </div>

        {/* Generate Button & Back Side */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-4 mb-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || (!front.trim() && !imageUrl.trim())}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 monochrome:bg-gray-800 monochrome:hover:bg-black dark:monochrome:bg-gray-100 dark:monochrome:hover:bg-white text-white dark:monochrome:text-gray-900 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
              </svg>
              {isGenerating ? 'Generating...' : 'Back Side'}
              {!back.trim() && <span className="text-xs opacity-75 font-normal ml-0.5">({getShortcutDisplay('card.submit')})</span>}
            </button>
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>

          {/* Candidate Selector Cards */}
          {candidates.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Recommended Counterparts ({candidates.length})
                </label>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                  Click any option to apply
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {candidates.map((candidate, idx) => {
                  const isSelected = back.trim().toLowerCase() === candidate.term.trim().toLowerCase()
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBack(candidate.term)
                        if (!front.trim()) {
                          setSearchQuery(candidate.term)
                        }
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 ring-2 ring-purple-400/30 dark:ring-purple-500/30 monochrome:bg-gray-100 monochrome:border-gray-900 monochrome:ring-gray-400/30 dark:monochrome:bg-gray-800 dark:monochrome:border-gray-200 shadow-sm'
                          : 'bg-white dark:bg-[#1f2028] border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700/60 hover:bg-gray-50/50 dark:hover:bg-[#252733] monochrome:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 monochrome:bg-gray-200 monochrome:text-black dark:monochrome:bg-gray-800 dark:monochrome:text-white">
                            {idx + 1}. {candidate.tag || 'Option'}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white text-base">
                            {candidate.term}
                          </span>
                        </div>
                        {isSelected ? (
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 rounded-md monochrome:bg-gray-200 monochrome:text-black dark:monochrome:bg-gray-800 dark:monochrome:text-white">
                            Selected
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            Select
                          </span>
                        )}
                      </div>
                      {candidate.nuance && (
                        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">Nuance: </span>
                          {candidate.nuance}
                        </p>
                      )}
                      {candidate.example && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                          <span className="font-medium not-italic text-gray-400 dark:text-gray-500">e.g. </span>
                          {candidate.example}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          
          <textarea
            value={back}
            onChange={e => {
              const val = e.target.value
              setBack(val)
              if (!front.trim()) {
                setSearchQuery(val)
              }
            }}
            disabled={isGenerating}
            className={`w-full ${candidates.length > 0 ? 'h-32' : 'h-48'} p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm ${isGenerating ? 'opacity-50' : ''}`}
            placeholder="Selected English Counterpart (or type your own version)"
          />
        </div>

        <div className="flex items-center gap-3 justify-start pb-8">
          <button
            onClick={handleSave}
            disabled={(!front.trim() && !imageUrl.trim()) || !back.trim() || isGenerating}
            className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save
            {back.trim() && <span className="text-xs opacity-75 font-normal ml-0.5">({getShortcutDisplay('card.submit')})</span>}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isGenerating || isCaching || (!front && !context && !imageUrl && !back && candidates.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Clear form (${getShortcutDisplay('card.clear')})`}
          >
            <Eraser className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Right Panel: Duplicate Checker & Similar Words */}
      <FuzzyMatchList 
        similarCards={similarCards}
        mode={mode}
        isSearching={isSearching}
        isAnalyzing={isAnalyzing}
        emptyMessage={front.trim() ? "No Matching Words Found" : "Start typing to search existing words..."}
        onIncrement={handleIncrementReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}
