import { useState, useEffect } from 'react'

export function DailyWords() {
  const [front, setFront] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isCaching, setIsCaching] = useState(false)
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])

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
      setError('Please enter a target word first.')
      return
    }
    setError('')
    setIsGenerating(true)
    
    try {
      const res = await window.ipcRenderer.generateDailyWord(front)
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
      setError('Both Word and Translation are required.')
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
        front,
        back,
        imageUrl,
        label: ''
      })
      
      setFront('')
      setImageUrl('')
      setBack('')
      setError('')
      setSimilarCards([])
    } catch (err: any) {
      setError(err.message || 'Failed to save card.')
    }
  }

  const handleIncrementUseCount = async (id: number) => {
    try {
      await window.ipcRenderer.incrementUseCount(id)
      const updated = await window.ipcRenderer.searchCards(front.trim())
      setSimilarCards(updated)
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
        
        {/* Front Side */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Word (Front Side)</label>
          <input
            type="text"
            value={front}
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="Type the Word Here"
          />
        </div>

        {/* Image URL */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Image (Optional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="flex-1 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
              placeholder="Paste image URL or upload file..."
            />
            
            {imageUrl && imageUrl.startsWith('http') && (
              <button
                onClick={handleCacheImage}
                disabled={isCaching}
                className="px-6 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-2xl font-bold transition-colors disabled:opacity-50"
              >
                {isCaching ? 'Caching...' : 'Cache ⬇️'}
              </button>
            )}

            <button
              onClick={handleUploadLocal}
              disabled={isCaching}
              className="px-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold transition-colors disabled:opacity-50"
              title="Upload Local File"
            >
              📁
            </button>
          </div>
          
          {/* Cached Image Preview */}
          {imageUrl && !imageUrl.startsWith('http') && (
            <div className="mt-4 p-2 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl inline-block shadow-sm">
              <img src={`local-asset://${imageUrl}`} alt="Cached Preview" className="h-24 w-auto rounded-lg object-contain" />
              <div className="text-xs text-gray-500 mt-2 text-center">Cached Locally</div>
            </div>
          )}
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
              {isGenerating ? 'Generating...' : 'Translation (Back Side)'}
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
      <div className="w-80 bg-gray-100/50 dark:bg-[#16171d] rounded-2xl p-6 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800">
        {similarCards.length === 0 ? (
          <div className="text-center opacity-50 flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <p className="text-lg font-medium">No Similar Words Found</p>
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
