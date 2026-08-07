import { useState, useEffect } from 'react'
import { FuzzyMatchList } from './FuzzyMatchList'

interface DailyWordsProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}

export const DailyWords: React.FC<DailyWordsProps> = ({ onNavigate, onUpdateStats }) => {
  const [front, setFront] = useState('')
  const [context, setContext] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isCaching, setIsCaching] = useState(false)
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    if (front.trim().length > 1 || back.trim().length > 1) {
      const timer = setTimeout(() => {
        window.ipcRenderer.searchCards(front.trim(), back.trim(), 'Daily Words').then(setSimilarCards)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSimilarCards([])
    }
  }, [front, back])

  const handleGenerate = async () => {
    if (!front.trim() && !imageUrl.trim()) {
      setError('Please enter a target word or provide an image first.')
      return
    }
    setError('')
    setIsGenerating(true)
    
    try {
      const payload = {
        front: front.trim(),
        context: context.trim(),
        picture: imageUrl
      }
      const res = await window.ipcRenderer.generateDailyWord(payload)
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
    if (!front && !imageUrl) {
      setError('Either a Word or an Image is required.')
      return
    }
    if (!back) {
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
        front: front || '[Image Only]',
        back,
        sourceContext: context,
        imageUrl,
        label: ''
      })
      
      setFront('')
      setContext('')
      setImageUrl('')
      setBack('')
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
      const updated = await window.ipcRenderer.searchCards(front.trim(), back.trim(), 'Daily Words')
      setSimilarCards(updated)
      if (onUpdateStats) onUpdateStats()
      
      setToastMessage('+1 Added successfully!')
      setTimeout(() => setToastMessage(''), 3000)
    } catch (err: any) {
      console.error(err)
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

  return (
    <div className="flex h-full animate-in fade-in duration-500">
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        <div className="flex gap-6 mb-6">
          {/* Left Column: Front Side & Context */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1">Front Side</label>
              <input
                type="text"
                value={front}
                onChange={e => setFront(e.target.value)}
                className="w-full p-3 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
                placeholder="Type the Front Side..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1">Context</label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                className="w-full h-24 p-3 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
                placeholder="Type Your Context Here"
              />
            </div>
          </div>

          {/* Right Column: Picture */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1">Picture</label>
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
            
            <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center min-h-[150px] relative overflow-hidden">
              {imageUrl && !imageUrl.startsWith('http') ? (
                <img src={`local-asset://${imageUrl}`} alt="Cached Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
              ) : imageUrl ? (
                <img src={imageUrl} alt="External Preview" className="absolute inset-0 w-full h-full object-contain p-2 opacity-50" />
              ) : (
                <span className="text-gray-400 text-sm font-medium">Paste the Link of Your Photo</span>
              )}
            </div>
          </div>
        </div>

        {/* Generate Button & Back Side */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!front && !imageUrl)}
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
            placeholder="AI will generate the translation here..."
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={!front || !back || isGenerating}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Word
          </button>
        </div>
      </div>

      {/* Right Panel: Duplicate Checker */}
      <FuzzyMatchList 
        similarCards={similarCards}
        emptyMessage="No Similar Words Found"
        onIncrement={handleIncrementManualReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}
