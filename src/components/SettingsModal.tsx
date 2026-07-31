import React, { useState, useEffect } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'api'>('general')
  
  // General State
  const [showSplash, setShowSplash] = useState(true)

  // API State
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('https://api.sketchengine.eu/bonito/run.cgi')
  const [aiUrl, setAiUrl] = useState('https://api.openai.com/v1')
  const [aiKey, setAiKey] = useState('')
  const [aiModel, setAiModel] = useState('gpt-4o')
  const [validUntil, setValidUntil] = useState<string | null>(null)
  
  // UI State
  const [isValidating, setIsValidating] = useState(false)
  const [isAiValidating, setIsAiValidating] = useState(false)
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (isOpen) {
      window.ipcRenderer.getSettings().then(settings => {
        if (settings.sketchEngineKey) setApiKey(settings.sketchEngineKey)
        if (settings.sketchEngineUrl) setApiUrl(settings.sketchEngineUrl)
        if (settings.aiUrl) setAiUrl(settings.aiUrl)
        if (settings.aiKey) setAiKey(settings.aiKey)
        if (settings.aiModel) setAiModel(settings.aiModel)
        if (settings.sketchEngineValidUntil) setValidUntil(settings.sketchEngineValidUntil)
        if (settings.skipSplashScreen) setShowSplash(settings.skipSplashScreen !== 'true')
      })
    }
  }, [isOpen])

  const handleSave = async () => {
    await window.ipcRenderer.saveSettings({
      sketchEngineKey: apiKey,
      sketchEngineUrl: apiUrl,
      aiUrl,
      aiKey,
      aiModel,
      skipSplashScreen: showSplash ? 'false' : 'true',
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

  const handleValidateAi = async () => {
    setIsAiValidating(true)
    const result = await window.ipcRenderer.validateAiApi(aiUrl, aiKey, aiModel)
    setIsAiValidating(false)
    if (result.success) {
      showToast('AI Connection successful!', 'success')
      await window.ipcRenderer.saveSettings({ aiUrl, aiKey, aiModel })
    } else {
      showToast(`AI Connection failed: ${result.error}`, 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden bg-white/80 dark:bg-[#1f2028]/90 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all transform scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">Settings</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-[450px]">
          {/* Tabs */}
          <div className="w-48 bg-gray-50/30 dark:bg-black/10 border-r border-gray-200/50 dark:border-gray-700/50 p-4 space-y-2">
            <button 
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              General
            </button>
            <button 
              onClick={() => setActiveTab('api')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'api' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              AI & API
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Splash Screen</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Show the welcome animation and today's overview when launching the app.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={showSplash} onChange={e => setShowSplash(e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                        {isValidating ? 'Testing...' : 'Test'}
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between">
                      <span>API Base URL</span>
                    </label>
                    <input 
                      type="text" 
                      value={aiUrl || ''}
                      onChange={e => setAiUrl(e.target.value)}
                      className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white text-sm"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key
                    </label>
                    <input 
                      type="password" 
                      value={aiKey || ''}
                      onChange={e => setAiKey(e.target.value)}
                      className="w-full px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white text-sm"
                      placeholder="sk-..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between items-center">
                      <span>Model Name</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={aiModel}
                        onChange={e => setAiModel(e.target.value)}
                        className="flex-1 px-4 py-2 bg-white/50 dark:bg-black/20 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white text-sm"
                        placeholder="gpt-4o"
                      />
                      <button
                        onClick={handleValidateAi}
                        disabled={isAiValidating || !aiKey}
                        className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/60 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm whitespace-nowrap"
                      >
                        {isAiValidating ? 'Testing...' : 'Test AI'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
