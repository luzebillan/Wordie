import { useState, useEffect } from 'react'

export function UsefulExpressions() {
  const [expression, setExpression] = useState('')
  const [context, setContext] = useState('')
  const [style, setStyle] = useState('Formal')
  const [isGenerating, setIsGenerating] = useState(false)
  const [duplicates, setDuplicates] = useState<any[]>([])

  // Debounce expression input to check for duplicates
  useEffect(() => {
    const handler = setTimeout(() => {
      if (expression.trim().length > 1) {
        window.ipcRenderer.checkDuplicateCard(expression).then(setDuplicates)
      } else {
        setDuplicates([])
      }
    }, 500)
    return () => clearTimeout(handler)
  }, [expression])

  const handleIncrementUseCount = async (id: number) => {
    await window.ipcRenderer.incrementUseCount(id)
    // Refresh duplicates to show updated count
    window.ipcRenderer.checkDuplicateCard(expression).then(setDuplicates)
  }

  const handleGenerateAndSave = async () => {
    if (!expression.trim()) return

    setIsGenerating(true)
    try {
      const result = await window.ipcRenderer.generateUsefulExpression(expression, context, style)
      if (result.success && result.data) {
        const card = {
          type: 'Useful Expression',
          front: expression,
          back: JSON.stringify(result.data),
          style: style,
          label: ''
        }
        await window.ipcRenderer.createCard(card)
        // Reset form on success
        setExpression('')
        setContext('')
        setStyle('Formal')
        setDuplicates([])
      } else {
        alert('Failed to generate card: ' + result.error)
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex gap-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Left Form Panel */}
      <div className="flex-1 bg-white/60 dark:bg-black/30 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/10 shadow-2xl p-8 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-8 relative z-10 flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
          </span>
          New Useful Expression
        </h2>

        <div className="space-y-6 relative z-10 flex-1">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Target Expression
            </label>
            <input 
              type="text" 
              value={expression}
              onChange={e => setExpression(e.target.value)}
              placeholder="e.g. at the end of the day..."
              className="w-full px-5 py-4 bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white text-lg placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Context (Where did you see it?)
            </label>
            <textarea 
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Paste the paragraph or sentence here..."
              rows={4}
              className="w-full px-5 py-4 bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white resize-none placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Style / Register
            </label>
            <select
              value={style}
              onChange={e => setStyle(e.target.value)}
              className="w-full px-5 py-4 bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white appearance-none cursor-pointer"
            >
              <option value="Formal">👔 Formal (Business / Academic)</option>
              <option value="Informal">☕ Informal (Daily Conversation)</option>
              <option value="Slang">🔥 Slang (Street / Internet)</option>
              <option value="Idiom">🧩 Idiom</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleGenerateAndSave}
          disabled={!expression.trim() || isGenerating}
          className="mt-8 w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating via AI...
            </>
          ) : (
            'Generate & Save Card'
          )}
        </button>
      </div>

      {/* Right Duplicates Panel */}
      {duplicates.length > 0 && (
        <div className="w-80 flex flex-col gap-4 animate-in slide-in-from-right-8 duration-500">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-orange-800 dark:text-orange-300 flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Similar Cards Found
            </h3>
            <p className="text-xs text-orange-600 dark:text-orange-400/80">
              You already have cards matching this expression. Instead of creating a duplicate, you can increment its use count.
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pb-8">
            {duplicates.map(dup => {
              let def = ''
              try {
                const parsed = JSON.parse(dup.back)
                def = parsed.definition
              } catch (e) {
                def = dup.back
              }
              
              return (
                <div key={dup.id} className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{dup.front}</h4>
                    <span className="bg-gray-100 dark:bg-gray-800 text-xs px-2 py-1 rounded-md font-mono text-gray-500">
                      Used: {dup.useCount}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">
                    {def}
                  </p>
                  <button 
                    onClick={() => handleIncrementUseCount(dup.id)}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                    +1 Use Count
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
