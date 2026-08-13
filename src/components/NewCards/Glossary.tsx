import { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'
import { FuzzyMatchList } from './FuzzyMatchList'
import { DOMAINS, getStoredDomainFields } from '../../constants/domains'

interface GlossaryProps {
  onNavigate?: (view: string, props?: any) => void;
  onUpdateStats?: () => void;
}



export const Glossary: React.FC<GlossaryProps> = ({ onNavigate, onUpdateStats }) => {
  const [domainFields, setDomainFields] = useState<Record<string, string[]>>(getStoredDomainFields())
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS[0])
  const [newFieldInput, setNewFieldInput] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [similarCards, setSimilarCards] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState('')

  const [confirmDeleteField, setConfirmDeleteField] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('glossaryDomainFields', JSON.stringify(domainFields))
  }, [domainFields])

  const currentFields = domainFields[selectedDomain] || []

  const toggleLabel = (label: string) => {
    if (labels.includes(label)) {
      setLabels(labels.filter(l => l !== label))
    } else {
      setLabels([...labels, label])
    }
  }

  const handleAddField = () => {
    const fieldName = newFieldInput.trim()
    if (!fieldName) return
    
    setDomainFields(prev => {
      const fields = prev[selectedDomain] || []
      if (fields.includes(fieldName)) return prev
      return {
        ...prev,
        [selectedDomain]: [...fields, fieldName]
      }
    })
    setNewFieldInput('')
    
    const newLabel = `${selectedDomain}\\${fieldName}`
    if (!labels.includes(newLabel)) {
      setLabels(prev => [...prev, newLabel])
    }
  }

  const handleDeleteField = (fieldToDelete: string) => {
    setDomainFields(prev => {
      const fields = prev[selectedDomain] || []
      return {
        ...prev,
        [selectedDomain]: fields.filter(f => f !== fieldToDelete)
      }
    })
    
    const labelToRemove = `${selectedDomain}\\${fieldToDelete}`
    setLabels(prev => prev.filter(l => l !== labelToRemove))
    setConfirmDeleteField(null)
  }

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
        let finalBack = res.result
        try {
          const parsed = JSON.parse(res.result)
          setFront(parsed.front)
          setBack(parsed.back)
          finalBack = parsed.back
        } catch {
          // Fallback if somehow it's not the exact JSON structure string we returned
          setBack(res.result)
        }
        const updated = await window.ipcRenderer.findSimilarCards(front, finalBack, 'Glossary', true)
        setSimilarCards(updated)
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
    
    if (labels.length === 0) {
      setError('Please select at least one field.')
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
      setNewFieldInput('')
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
    <div className="flex h-full animate-in fade-in duration-500" onClick={() => setConfirmDeleteField(null)}>
      {/* Left Panel: Form */}
      <div className="flex-1 pl-1 pt-1 pr-8 overflow-y-auto">
        
        {/* Domain and Field */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Domain / Fields</label>
          
          <div className="mb-3">
            <select
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            >
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          {/* Fields Area */}
          <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-gray-800/50">
            <div className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Select fields for <span className="text-gray-700 dark:text-gray-300 font-bold">{selectedDomain}</span>:
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              {currentFields.map(field => {
                const labelStr = `${selectedDomain}\\${field}`
                const isSelected = labels.includes(labelStr)
                const isConfirming = confirmDeleteField === field
                
                return (
                  <div key={field} className="group relative inline-flex items-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLabel(labelStr); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                        isSelected 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-600' 
                          : 'bg-white dark:bg-[#1f2028] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-purple-300 shadow-sm'
                      }`}
                    >
                      {field}
                    </button>
                    
                    {isConfirming ? (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 bg-white dark:bg-gray-800 shadow-lg px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 animate-in fade-in zoom-in duration-150">
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap mr-1">Delete?</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteField(field); }}
                          className="text-[10px] font-bold bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteField(null); }}
                          className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteField(field); }}
                        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-sm"
                        title="Delete field"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}
              
              <div className="inline-flex items-center ml-1">
                <input 
                  type="text" 
                  value={newFieldInput}
                  onChange={e => setNewFieldInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddField()}
                  placeholder="+ Add Field"
                  className="px-3 py-1.5 text-sm bg-transparent border border-dashed border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:border-purple-500 focus:border-solid transition-colors w-28 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
          
          {/* Selected Labels Summary */}
          {labels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {labels.map(label => (
                <span key={label} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-transparent dark:border-purple-800/50 rounded-full text-sm font-medium">
                  {label}
                  <button onClick={() => toggleLabel(label)} className="hover:text-purple-900 dark:hover:text-purple-100 opacity-70 hover:opacity-100 transition-opacity">
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Front Side */}
        <div className="mb-6">
          <label className="block text-lg font-bold text-gray-900 dark:text-white mb-2">Term</label>
          <textarea
            value={front}
            onChange={e => {
              setFront(e.target.value)
              setSimilarCards([])
            }}
            className="w-full p-4 h-24 resize-none bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm"
            placeholder="e.g. LLM"
          />
        </div>

        {/* Generate Button & Back Side */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !front || labels.length === 0}
              title={labels.length === 0 ? "Select at least one field" : ""}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 monochrome:bg-gray-800 monochrome:hover:bg-black dark:monochrome:bg-gray-100 dark:monochrome:hover:bg-white text-white dark:monochrome:text-gray-900 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
              </svg>
              {isGenerating ? 'Generating...' : 'Create Glossary'}
            </button>
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>
          
          <textarea
            value={back}
            onChange={e => {
              setBack(e.target.value)
              setSimilarCards([])
            }}
            disabled={isGenerating}
            className={`w-full h-56 p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-shadow text-gray-800 dark:text-gray-200 shadow-sm ${isGenerating ? 'opacity-50' : ''}`}
            placeholder="AI-Generated Glossary Content Here"
          />
        </div>

        <div className="flex justify-start pb-8">
          <button
            onClick={handleSave}
            disabled={!front || !back || isGenerating || labels.length === 0}
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
        emptyMessage="No Similar Terms Found"
        onIncrement={handleIncrementManualReviewCount}
        onNavigate={onNavigate}
        toastMessage={toastMessage}
      />
    </div>
  )
}

