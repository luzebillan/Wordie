import React, { useState, useEffect } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('https://api.sketchengine.eu/bonito/run.cgi')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiApiUrl, setAiApiUrl] = useState('')
  const [aiModel, setAiModel] = useState('gpt-4o')
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (isOpen) {
      window.ipcRenderer.getSettings().then(settings => {
        if (settings.sketchEngineKey) setApiKey(settings.sketchEngineKey)
        if (settings.sketchEngineUrl) setApiUrl(settings.sketchEngineUrl)
        if (settings.aiApiKey) setAiApiKey(settings.aiApiKey)
        if (settings.aiApiUrl) setAiApiUrl(settings.aiApiUrl)
        if (settings.aiModel) setAiModel(settings.aiModel)
        if (settings.sketchEngineValidUntil) setValidUntil(settings.sketchEngineValidUntil)
      })
    }
  }, [isOpen])

  const handleSave = async () => {
    await window.ipcRenderer.saveSettings({
      sketchEngineKey: apiKey,
      sketchEngineUrl: apiUrl,
      aiApiKey,
      aiApiUrl,
      aiModel,
      ...(validUntil ? { sketchEngineValidUntil: validUntil } : {})
    })
    showToast('Settings saved successfully', 'success')
    setTimeout(onClose, 1500)
  }

  const handleValidate = async () => {
    setIsValidating(true)
    const result = await window.ipcRenderer.validateSketchEngine(apiUrl, apiKey)
    setIsValidating(false)
    if (result.success) {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 31)
      const dateString = futureDate.toISOString().split('T')[0]
      setValidUntil(dateString)
      showToast('Connection successful!', 'success')
      await window.ipcRenderer.saveSettings({
        sketchEngineKey: apiKey,
        sketchEngineUrl: apiUrl,
        sketchEngineValidUntil: dateString
      })
    } else {
      setValidUntil(null)
      showToast(`Connection failed: ${result.error}`, 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden bg-white/80 dark:bg-[#1f2028]/90 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all transform scale-100 animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">Preferences</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Sketch Engine API Group */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Sketch Engine API
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                <span>API Endpoint URL</span>
              </label>
              <input 
                type="text" 
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="https://api.sketchengine.eu/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between items-center">
                <span>Access Key</span>
                <a href="https://www.sketchengine.eu/my-account/" target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:text-purple-500 transition-colors">How to get this?</a>
              </label>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder="Enter your API key"
                />
                <button
                  onClick={handleValidate}
                  disabled={isValidating || !apiKey}
                  className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-800/60 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isValidating ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              {validUntil && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Valid until: {validUntil}
                </p>
              )}
            </div>
          </div>

          {/* AI Configuration Group */}
          <div className="space-y-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              AI Assistant
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Base URL (Optional)
              </label>
              <input 
                type="text" 
                value={aiApiUrl}
                onChange={e => setAiApiUrl(e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="https://api.openai.com/v1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input 
                type="password" 
                value={aiApiKey}
                onChange={e => setAiApiKey(e.target.value)}
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="Enter AI API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model Name
              </label>
              <input 
                type="text" 
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                list="model-suggestions"
                className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                placeholder="e.g. gpt-4o, claude-3-5-sonnet, deepseek-chat"
              />
              <datalist id="model-suggestions">
                <option value="gpt-4o" />
                <option value="gpt-4o-mini" />
                <option value="claude-3-5-sonnet" />
                <option value="gemini-1.5-pro" />
                <option value="gemini-1.5-flash" />
                <option value="deepseek-chat" />
                <option value="deepseek-coder" />
              </datalist>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50/50 dark:bg-black/20 border-t border-gray-200/50 dark:border-gray-700/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-medium shadow-lg shadow-purple-500/30 transition-all transform hover:scale-105 active:scale-95"
          >
            Save Changes
          </button>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/80 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-100'
          }`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  )
}
