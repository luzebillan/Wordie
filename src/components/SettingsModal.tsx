import React, { useState, useEffect } from 'react'
import * as Prompts from '../constants/prompts'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'data' | 'advanced' | 'prompts'>('general')
  
  // General State
  const [showSplash, setShowSplash] = useState(true)
  const [theme, setTheme] = useState('system')
  const [themeColor, setThemeColor] = useState('monochrome')

  // API State
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('https://api.sketchengine.eu/bonito/run.cgi')
  const [aiUrl, setAiUrl] = useState('https://api.openai.com/v1')
  const [aiKey, setAiKey] = useState('')
  const [aiModel, setAiModel] = useState('gpt-4o')
  const [validUntil, setValidUntil] = useState<string | null>(null)

  // Advanced State
  const [semanticMatchDistance, setSemanticMatchDistance] = useState('1.4')
  const [srsReward, setSrsReward] = useState('2.5')
  const [srsPenalty, setSrsPenalty] = useState('0.2')
  const [rewriteDivider, setRewriteDivider] = useState('20')
  
  // Prompts State
  const [promptGlossary, setPromptGlossary] = useState('')
  const [promptDailyWord, setPromptDailyWord] = useState('')
  const [promptPracticeAi, setPromptPracticeAi] = useState('')
  const [promptRewrite, setPromptRewrite] = useState('')
  const [promptExpression, setPromptExpression] = useState('')
  const [promptRevisionCloze, setPromptRevisionCloze] = useState('')
  const [promptPureListener, setPromptPureListener] = useState('')
  const [promptPracticeExtract, setPromptPracticeExtract] = useState('')
  const [promptPracticeRewrite, setPromptPracticeRewrite] = useState('')
  const [promptAiVersion, setPromptAiVersion] = useState('')
  const [promptSynonyms, setPromptSynonyms] = useState('')
  
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
        if (settings.theme) setTheme(settings.theme)
        if (settings.themeColor) setThemeColor(settings.themeColor)
        if (settings.semanticMatchDistance) setSemanticMatchDistance(settings.semanticMatchDistance)
        if (settings.srsReward) setSrsReward(settings.srsReward)
        if (settings.srsPenalty) setSrsPenalty(settings.srsPenalty)
        if (settings.rewriteDivider) setRewriteDivider(settings.rewriteDivider)
        setPromptGlossary(settings.promptGlossary || Prompts.DEFAULT_PROMPT_GLOSSARY)
        setPromptDailyWord(settings.promptDailyWord || Prompts.DEFAULT_PROMPT_DAILY_WORD)
        setPromptPracticeAi(settings.promptPracticeAi || Prompts.DEFAULT_PROMPT_PRACTICE_AI)
        setPromptRewrite(settings.promptRewrite || Prompts.DEFAULT_PROMPT_REWRITE)
        setPromptExpression(settings.promptExpression || Prompts.DEFAULT_PROMPT_EXPRESSION)
        setPromptRevisionCloze(settings.promptRevisionCloze || Prompts.DEFAULT_PROMPT_REVISION_CLOZE)
        setPromptPureListener(settings.promptPureListener || Prompts.DEFAULT_PROMPT_PURE_LISTENER)
        setPromptPracticeExtract(settings.promptPracticeExtract || Prompts.DEFAULT_PROMPT_PRACTICE_EXTRACT)
        setPromptPracticeRewrite(settings.promptPracticeRewrite || Prompts.DEFAULT_PROMPT_PRACTICE_REWRITE)
        setPromptAiVersion(settings.promptAiVersion || Prompts.DEFAULT_PROMPT_AI_VERSION)
        setPromptSynonyms(settings.promptSynonyms || Prompts.DEFAULT_PROMPT_SYNONYMS)
      })
    }
  }, [isOpen])

  const autoSave = async (key: string, value: string) => {
    await window.ipcRenderer.saveSettings({ [key]: value })
    window.dispatchEvent(new Event('settings-updated'))
  }

  const renderPromptField = (title: string, value: string, setter: (val: string) => void, saveKey: string, desc: string, defaultPrompt: string) => {
    const handleBlur = () => {
      if (!value.trim()) {
        setter(defaultPrompt)
        autoSave(saveKey, '')
      } else {
        autoSave(saveKey, value === defaultPrompt ? '' : value)
      }
    }

    return (
      <div className="space-y-2 p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{title}</label>
          <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
        </div>
        <textarea
          value={value}
          onChange={(e) => setter(e.target.value)}
          onBlur={handleBlur}
          placeholder="Leave empty to use default..."
          rows={6}
          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-gray-200 resize-y font-mono text-[13px]"
        />
      </div>
    )
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

  const handleExport = async () => {
    const res = await window.ipcRenderer.exportData()
    if (res.canceled) return
    if (res.success) {
      showToast(`Successfully exported ${res.count} cards`, 'success')
    } else {
      showToast(`Export failed: ${res.error}`, 'error')
    }
  }

  const handleImport = async () => {
    const res = await window.ipcRenderer.importData()
    if (res.canceled) return
    if (res.success) {
      showToast(`Imported ${res.imported} cards (${res.skipped} skipped)`, 'success')
      window.dispatchEvent(new Event('settings-updated')) // To refresh data if needed
    } else {
      showToast(`Import failed: ${res.error}`, 'error')
    }
  }

  const handleClear = async () => {
    const res = await window.ipcRenderer.clearData()
    if (res.canceled) return
    if (res.success) {
      showToast('Database cleared successfully', 'success')
      window.dispatchEvent(new Event('settings-updated'))
    } else {
      showToast(`Failed to clear database: ${res.error}`, 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-[80vw] min-w-[700px] max-w-[950px] h-[75vh] min-h-[500px] max-h-[700px] flex flex-col overflow-hidden bg-white/80 dark:bg-[#1f2028]/90 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all transform scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center shrink-0">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-56 bg-gray-50/30 dark:bg-black/10 border-r border-gray-200/50 dark:border-gray-700/50 p-4 space-y-2 overflow-y-auto shrink-0">
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
            <button 
              onClick={() => setActiveTab('prompts')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'prompts' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              AI Prompts
            </button>
            <button 
              onClick={() => setActiveTab('advanced')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'advanced' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Advanced / Algorithm
            </button>
            <button 
              onClick={() => setActiveTab('data')}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'data' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Data Management
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
                    <input type="checkbox" className="sr-only peer" checked={showSplash} onChange={e => {
                      setShowSplash(e.target.checked)
                      autoSave('skipSplashScreen', e.target.checked ? 'false' : 'true')
                    }} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Appearance</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Light or dark mode.</p>
                  </div>
                  <select 
                    value={theme}
                    onChange={e => {
                      setTheme(e.target.value)
                      autoSave('theme', e.target.value)
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  >
                    <option value="system">System Default</option>
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Theme Color</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Colorful or monochrome.</p>
                  </div>
                  <select 
                    value={themeColor}
                    onChange={e => {
                      setThemeColor(e.target.value)
                      autoSave('themeColor', e.target.value)
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  >
                    <option value="monochrome">Monochrome (Default)</option>
                    <option value="colorful">Colorful</option>
                  </select>
                </div>
              </div>
            ) : activeTab === 'api' ? (
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
                      onBlur={() => autoSave('sketchEngineUrl', apiUrl)}
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
                        onBlur={() => autoSave('sketchEngineKey', apiKey)}
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
                      onBlur={() => autoSave('aiUrl', aiUrl)}
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
                      onBlur={() => autoSave('aiKey', aiKey)}
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
                        onBlur={() => autoSave('aiModel', aiModel)}
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
            ) : activeTab === 'data' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Backup & Restore
                  </h3>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Export Cards</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Save a backup of all your cards locally in JSON format.</p>
                    </div>
                    <button onClick={handleExport} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                      Export Data
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Import Cards</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Restore from a backup JSON file. Duplicates will be skipped safely.</p>
                    </div>
                    <button onClick={handleImport} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                      Import Data
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Danger Zone
                  </h3>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-900/30">
                    <div>
                      <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Clear Database</h3>
                      <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">Delete all cards and review history. Your API settings will not be affected.</p>
                    </div>
                    <button onClick={handleClear} className="px-4 py-2 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg text-sm font-bold text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors shadow-sm">
                      Clear Data
                    </button>
                  </div>
                </div>
                </div>
              ) : activeTab === 'advanced' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Algorithm Tweaks
                    </h3>

                    <div className="space-y-4 p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200/50 dark:border-gray-700/50">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Semantic Match Threshold
                        </label>
                        <input
                          type="text"
                          value={semanticMatchDistance}
                          onChange={(e) => setSemanticMatchDistance(e.target.value)}
                          onBlur={() => autoSave('semanticMatchDistance', semanticMatchDistance)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-gray-200"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Controls strictness for fuzzy matching in Rewrite module (default 1.4).</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            SRS Reward Coefficient
                          </label>
                          <input
                            type="text"
                            value={srsReward}
                            onChange={(e) => setSrsReward(e.target.value)}
                            onBlur={() => autoSave('srsReward', srsReward)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-gray-200"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Multiplier when clicking Got it! (default 2.5).</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            SRS Penalty Coefficient
                          </label>
                          <input
                            type="text"
                            value={srsPenalty}
                            onChange={(e) => setSrsPenalty(e.target.value)}
                            onBlur={() => autoSave('srsPenalty', srsPenalty)}
                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-gray-200"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">Multiplier when clicking Forget (default 0.2).</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Rewrite Expression Divider
                        </label>
                        <input
                          type="text"
                          value={rewriteDivider}
                          onChange={(e) => setRewriteDivider(e.target.value)}
                          onBlur={() => autoSave('rewriteDivider', rewriteDivider)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-gray-200"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Number of expressions to optimize in Practice = total_cards / divider (default 20).</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'prompts' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      Prompt Engineering
                    </h3>
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400 pb-2">
                      Leave fields empty to use system defaults. Do not remove placeholders like <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{{var}}`}</code>.
                    </p>

                    {renderPromptField('Glossary Definition', promptGlossary, setPromptGlossary, 'promptGlossary', 'Generates flashcard definitions. Placeholders: {{term}}, {{labels}}', Prompts.DEFAULT_PROMPT_GLOSSARY)}
                    {renderPromptField('Daily Word System Prompt', promptDailyWord, setPromptDailyWord, 'promptDailyWord', 'System persona for generating localized words from image or context.', Prompts.DEFAULT_PROMPT_DAILY_WORD)}
                    {renderPromptField('Synonyms Strict Filter', promptSynonyms, setPromptSynonyms, 'promptSynonyms', 'Filters AI synonyms. Placeholders: {{targetFront}}, {{targetBack}}, {{candidatesStr}}', Prompts.DEFAULT_PROMPT_SYNONYMS)}
                    {renderPromptField('Expression Generation', promptExpression, setPromptExpression, 'promptExpression', 'Creates concise English definitions. Placeholders: {{front}}, {{context}}', Prompts.DEFAULT_PROMPT_EXPRESSION)}
                    {renderPromptField('Revision Cloze', promptRevisionCloze, setPromptRevisionCloze, 'promptRevisionCloze', 'Creates cloze deletion sentences. Placeholders: {{display_phrase}}, {{back}}, {{clean_snippet}}, {{wordsToBlank}}', Prompts.DEFAULT_PROMPT_REVISION_CLOZE)}
                    
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">Practice Module</h4>
                    {renderPromptField('Pure Listener', promptPureListener, setPromptPureListener, 'promptPureListener', 'Evaluates overall logic. Placeholders: {{text}}', Prompts.DEFAULT_PROMPT_PURE_LISTENER)}
                    {renderPromptField('Rewrite Extraction', promptPracticeExtract, setPromptPracticeExtract, 'promptPracticeExtract', 'Extracts target phrases for optimization. Placeholders: {{targetCount}}, {{text}}', Prompts.DEFAULT_PROMPT_PRACTICE_EXTRACT)}
                    {renderPromptField('Rewrite Output', promptPracticeRewrite, setPromptPracticeRewrite, 'promptPracticeRewrite', 'Rewrites text integrating vocabulary. Placeholders: {{cardsContext}}, {{text}}', Prompts.DEFAULT_PROMPT_PRACTICE_REWRITE)}
                    {renderPromptField('AI Target Version', promptPracticeAi, setPromptPracticeAi, 'promptPracticeAi', 'Generates ideal interpreter delivery. Placeholders: {{text}}', Prompts.DEFAULT_PROMPT_PRACTICE_AI)}
                    {renderPromptField('Elite Upgrade', promptAiVersion, setPromptAiVersion, 'promptAiVersion', 'Upgrades English to elite level. Placeholders: {{text}}', Prompts.DEFAULT_PROMPT_AI_VERSION)}
                    {renderPromptField('Vocabulary Fusion', promptRewrite, setPromptRewrite, 'promptRewrite', 'Rephrases text using specific vocab. Placeholders: {{dbText}}, {{text}}', Prompts.DEFAULT_PROMPT_REWRITE)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

        {/* Footer removed per user requirement: no Cancel/Save buttons */}

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
