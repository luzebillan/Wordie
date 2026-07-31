import { useState, useEffect } from 'react'

interface DuplicateCard {
  id: number
  front: string
  back: string
  useCount: number
  createdAt: string
}

export function NewCardExpressions() {
  const [target, setTarget] = useState('')
  const [context, setContext] = useState('')
  const [style, setStyle] = useState('Standard')
  
  const [duplicates, setDuplicates] = useState<DuplicateCard[]>([])
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedData, setGeneratedData] = useState<any>(null)
  const [error, setError] = useState('')

  // Debounced duplicate search
  useEffect(() => {
    if (!target.trim()) {
      setDuplicates([])
      return
    }
    const timer = setTimeout(() => {
      window.ipcRenderer.searchCards(target.trim()).then(res => {
        setDuplicates(res)
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [target])

  const handleGenerate = async () => {
    if (!target.trim()) return
    setIsGenerating(true)
    setError('')
    setGeneratedData(null)
    
    try {
      const res = await window.ipcRenderer.aiGenerateCard(target, context, style)
      if (res.success && res.data) {
        setGeneratedData(res.data)
      } else {
        setError(res.error || 'Failed to generate card content.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedData) return
    const front = generatedData.target || target
    const back = JSON.stringify(generatedData, null, 2)
    
    await window.ipcRenderer.createCard({
      type: 'expression',
      front,
      back,
      style: style,
      label: context
    })
    
    // Reset form
    setTarget('')
    setContext('')
    setStyle('Standard')
    setGeneratedData(null)
    // Optional: show a toast notification here
    alert('Card saved successfully!')
  }

  const handleIncrement = async (id: number) => {
    await window.ipcRenderer.incrementUseCount(id)
    // Refresh duplicates to show new count
    const res = await window.ipcRenderer.searchCards(target.trim())
    setDuplicates(res)
  }

  return (
    <div className="flex h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Left: Input Form & Generation Preview */}
      <div className="flex-1 flex flex-col gap-6 max-w-2xl">
        <div className="bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Useful Expressions
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Word / Phrase</label>
              <input 
                type="text" 
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="e.g. out of the blue"
                className="w-full px-4 py-2 bg-white dark:bg-black/40 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Context</label>
                <input 
                  type="text" 
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="e.g. At a meeting, casual chat..."
                  className="w-full px-4 py-2 bg-white dark:bg-black/40 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white"
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Style</label>
                <select 
                  value={style}
                  onChange={e => setStyle(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-black/40 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all dark:text-white"
                >
                  <option>Standard</option>
                  <option>Formal</option>
                  <option>Casual</option>
                  <option>Slang</option>
                  <option>Business</option>
                  <option>Academic</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !target.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Generating AI Content...
                </>
              ) : (
                'Generate with AI'
              )}
            </button>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>
        </div>

        {/* Generated Preview */}
        {generatedData && (
          <div className="bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm animate-in zoom-in-95 duration-300">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Generated Preview
            </h3>
            
            <div className="mb-6">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{generatedData.target || target}</h1>
              {generatedData.pronunciation && (
                <p className="text-purple-600 dark:text-purple-400 font-mono text-sm mb-4">/{generatedData.pronunciation}/</p>
              )}
              <p className="text-lg text-gray-700 dark:text-gray-300 font-medium mb-4">{generatedData.translation}</p>
              
              <div className="space-y-4">
                {generatedData.example && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30">
                    <p className="text-sm text-purple-600 dark:text-purple-400 font-bold mb-1 uppercase tracking-wider">Example</p>
                    <p className="text-gray-800 dark:text-gray-200 italic">{generatedData.example}</p>
                  </div>
                )}
                
                {generatedData.usage && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mb-1 uppercase tracking-wider">Usage Note</p>
                    <p className="text-gray-800 dark:text-gray-200 text-sm">{generatedData.usage}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-xl font-medium transition-all shadow-md cursor-pointer"
            >
              Save to Deck
            </button>
          </div>
        )}
      </div>

      {/* Right: Duplicates Panel */}
      <div className="w-80 flex flex-col gap-4">
        {duplicates.length > 0 ? (
          <>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2 px-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Similar Cards Found
            </h3>
            {duplicates.map(dup => (
              <div key={dup.id} className="bg-white/60 dark:bg-black/20 backdrop-blur-md rounded-xl border border-orange-200 dark:border-orange-900/30 p-4 shadow-sm animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100">{dup.front}</h4>
                  <span className="text-xs font-mono bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-md">Used: {dup.useCount || 0}</span>
                </div>
                <button
                  onClick={() => handleIncrement(dup.id)}
                  className="mt-3 w-full py-2 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-800/50 text-orange-700 dark:text-orange-400 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                >
                  +1 Use Count
                </button>
              </div>
            ))}
          </>
        ) : (
          target.trim() && (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
              <p className="text-sm text-gray-400 dark:text-gray-500">No duplicates found.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
